import { configuredClient, checkAdmin } from './shared.js';
const $ = id => document.getElementById(id);
const form = $('exam-form'), fileInput = $('csv-file'), feedback = $('feedback');
const mapping = $('mapping'), preview = $('preview'), subjectColumns = $('subject-columns');
let client, parsedRows = [], headers = [], candidate = null, codes = null, codesSaved = false;
let importInFlight = false;
function goLogin() { location.replace('login.html'); }
function resetPreview() { candidate = null; preview.hidden = true; feedback.replaceChildren(); }
function notice(messages, isError = true) {
  feedback.replaceChildren(); const list = document.createElement('ul');
  list.className = isError ? 'error-list' : 'hint';
  messages.slice(0, 25).forEach(text => { const li = document.createElement('li'); li.textContent = text; list.append(li); });
  if (messages.length > 25) { const li = document.createElement('li'); li.textContent = `And ${messages.length - 25} more errors.`; list.append(li); }
  feedback.append(list);
}
function fillSelect(el, withEmpty) {
  el.replaceChildren();
  if (withEmpty) el.add(new Option('None', ''));
  else el.add(new Option('Select a column', ''));
  headers.forEach((header, i) => el.add(new Option(header, String(i))));
}
function populateMapping() {
  fillSelect($('index-column'), false); fillSelect($('name-column'), true); fillSelect($('rank-column'), true); fillSelect($('zscore-column'), true); subjectColumns.replaceChildren();
  headers.forEach((header, i) => {
    const label = document.createElement('label'), input = document.createElement('input');
    input.type = 'checkbox'; input.value = String(i); label.append(input, document.createTextNode(header)); subjectColumns.append(label);
  });
  const idx = headers.findIndex(h => /^(enrollment[_\s-]*number|index[_\s-]*(number|no)?|index)$/i.test(h));
  const name = headers.findIndex(h => /^(student[_\s-]*name|name)$/i.test(h));
  const auxiliary = new Set(headers.map((h,i)=>/^(stream|original_record_json)$/i.test(h)?i:-1).filter(i=>i>=0));
  const rank = headers.findIndex(h => /^rank$/i.test(h));
  const zscore = headers.findIndex(h => /^z[\s_-]*score$/i.test(h));
  if (idx >= 0) $('index-column').value = String(idx);
  if (name >= 0) $('name-column').value = String(name);
  if (rank >= 0) $('rank-column').value = String(rank);
  if (zscore >= 0) $('zscore-column').value = String(zscore);
  subjectColumns.querySelectorAll('input').forEach((box,i) => { box.checked = i !== idx && i !== name && i !== rank && i !== zscore && !auxiliary.has(i); });
}
fileInput.addEventListener('change', () => {
  resetPreview(); mapping.hidden = true; headers = []; parsedRows = [];
  const file = fileInput.files[0]; if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) { notice(['Please choose a .csv file.']); return; }
  if (file.size === 0 || file.size > 2 * 1024 * 1024) { notice(['The CSV must be non-empty and no larger than 2 MB.']); return; }
  Papa.parse(file, {header:false, encoding:'UTF-8', skipEmptyLines:false, complete(result) {
    if (result.errors.length) { notice(result.errors.map(e => `CSV format error: ${e.message}`)); return; }
    const rows = result.data;
    if (!rows.length || rows[0].length < 2) { notice(['The CSV must have a header and at least two columns.']); return; }
    headers = rows[0].map(x => String(x).replace(/^\uFEFF/, '').trim());
    if (headers.some(h => /^__tdusa_/i.test(h))) { notice(['Column names beginning __tdusa_ are reserved. Rename them before importing.']); return; }
    if (headers.some(h => !h) || new Set(headers.map(h => h.toLowerCase())).size !== headers.length) { notice(['Column headers must be present and unique.']); return; }
    if (headers.some(h => h.includes('\uFFFD')) || rows.some(row => row.some(x => String(x).includes('\uFFFD')))) { notice(['The file may not be valid UTF-8. Save it as UTF-8 CSV and try again.']); return; }
    parsedRows = rows.slice(1);
    const historicalExport=headers.some(h=>/^original_record_json$/i.test(h));
    if(historicalExport)$('result-format').value='historical';
    populateMapping(); mapping.hidden = false;
    const instructions=[`File loaded: ${file.name}. Check the column mapping, then validate.`];
    if(historicalExport)instructions.push('Historical format selected for the TDUSA backup. The stream and original record columns are excluded from subjects. Use fictional records only in this test project.');
    notice(instructions, false);
  }, error() { notice(['Could not read the CSV file.']); }});
});
$('index-column').addEventListener('change', resetPreview);
$('name-column').addEventListener('change', resetPreview);
$('rank-column').addEventListener('change', resetPreview);
$('zscore-column').addEventListener('change', resetPreview);
$('result-format').addEventListener('change', resetPreview);
form.querySelectorAll('[name=access_mode]').forEach(el=>el.addEventListener('change',resetPreview));
subjectColumns.addEventListener('change', resetPreview);
$('preview-button').addEventListener('click', () => {
  resetPreview(); const errors = []; const idxText = $('index-column').value, nameText = $('name-column').value;
  const rankText=$('rank-column').value, zText=$('zscore-column').value, historical=$('result-format').value==='historical';
  const streamIndex=headers.findIndex(h=>/^stream$/i.test(h)),backupIndex=headers.findIndex(h=>/^original_record_json$/i.test(h));
  if(streamIndex>=0&&new Set(parsedRows.map(row=>String(row[streamIndex]||'').trim()).filter(Boolean)).size>1)errors.push('This CSV contains multiple streams. Use one separate CSV per examination or stream.');
  const selected = [...subjectColumns.querySelectorAll('input:checked')].map(x => Number(x.value));
  if (idxText === '') errors.push('Select the enrollment or index-number column.');
  if (!selected.length) errors.push('Select at least one result column.');
  if (idxText !== '' && selected.includes(Number(idxText))) errors.push('The index column cannot also be a result column.');
  const mapped=[idxText,nameText,rankText,zText].filter(x=>x!=='');
  if (new Set(mapped).size!==mapped.length || mapped.some(v=>selected.includes(Number(v)))) errors.push('Index, name, rank, Z-score and subject columns must be different.');
  if (errors.length) { notice(errors); return; }
  const spreadsheetPlaceholder=value=>historical&&/^'-{2,20}$/.test(value)?value.slice(1):value;
  const idx = Number(idxText), name = nameText === '' ? null : Number(nameText), rank=rankText===''?null:Number(rankText), zscore=zText===''?null:Number(zText);
  const valid = [], seen = new Set(); let blank = 0;
  parsedRows.forEach((row, rowIndex) => {
    const line = rowIndex + 2;
    if (row.every(x => !String(x).trim())) { blank++; return; }
    if (row.length !== headers.length) { errors.push(`Row ${line}: expected ${headers.length} columns, found ${row.length}.`); return; }
    const enrollment = String(row[idx]).trim();
    if (!enrollment || enrollment.length > 80) errors.push(`Row ${line}: missing or invalid index number.`);
    if (enrollment && seen.has(enrollment)) errors.push(`Row ${line}: duplicate index number ${enrollment}.`);
    if (enrollment) seen.add(enrollment);
    let originalSubjects=null;
    if(historical&&backupIndex>=0){try{const original=JSON.parse(String(row[backupIndex]));if(!original||typeof original!=='object'||!original.subjects||typeof original.subjects!=='object'||Array.isArray(original.subjects)||String(original.index).trim()!==enrollment)throw Error('Invalid backup');originalSubjects=original.subjects;}catch{errors.push(`Row ${line}: original backup data is invalid or its index does not match.`);}}
    const result = Object.create(null);
    for (const i of selected) {
      const value = String(row[i]).trim(), number = Number(value);
      if(originalSubjects&&!Object.prototype.hasOwnProperty.call(originalSubjects,headers[i])&&!value)continue;
      if (historical) {if(value.length>120)errors.push(`Row ${line}: ${headers[i]} exceeds 120 characters.`);}
      else if (!value) errors.push(`Row ${line}: ${headers[i]} is missing.`);
      else if (!/^(A|B|C|S|W|ABSENT)$/i.test(value) && !(/^(?:\d{1,3})(?:\.\d+)?$/.test(value) && number >= 0 && number <= 100)) errors.push(`Row ${line}: ${headers[i]} must be 0–100, A, B, C, S, W, or Absent.`);
      result[headers[i]] = value;
    }
    if(rank!==null){const value=spreadsheetPlaceholder(String(row[rank]).trim());if(value&&!/^(?:[0-9]{1,20}|-{2,20})$/.test(value))errors.push(`Row ${line}: rank must be a whole number or dashes.`);if(value)result.__tdusa_rank=value;}
    if(zscore!==null){const value=spreadsheetPlaceholder(String(row[zscore]).trim());if(value&&!/^(?:[+-]?[0-9]+(?:\.[0-9]+)?|-{2,20})$/.test(value)||value.length>30)errors.push(`Row ${line}: invalid Z-score.`);if(value)result.__tdusa_zscore=value;}
    valid.push({enrollment_number:enrollment,student_name:name === null ? null : String(row[name]).trim(),result_data:result});
  });
  if (!valid.length) errors.push('The file contains no non-empty student records.');
  const maxRecords=form.querySelector('[name=access_mode]:checked').value==='index_only'?200:100;
  if (valid.length > maxRecords) errors.push(`This test import supports at most ${maxRecords} student records in the selected access mode.`);
  if (errors.length) { notice(errors); return; }
  candidate = valid;
  const head = $('preview-head'), body = $('preview-body'); head.replaceChildren(); body.replaceChildren();
  const tr = document.createElement('tr'); ['Index number', ...(name !== null ? ['Name'] : []), ...(rank!==null?['Rank']:[]), ...(zscore!==null?['Z-score']:[]), ...selected.map(i => headers[i])].forEach(v => { const th=document.createElement('th'); th.textContent=v; tr.append(th); }); head.append(tr);
  valid.slice(0,10).forEach(record => { const row=document.createElement('tr'); [record.enrollment_number, ...(name !== null ? [record.student_name] : []), ...(rank!==null?[record.result_data.__tdusa_rank||'']:[]), ...(zscore!==null?[record.result_data.__tdusa_zscore||'']:[]), ...selected.map(i=>record.result_data[headers[i]])].forEach(value => { const cell=document.createElement('td'); cell.textContent=value; row.append(cell); }); body.append(row); });
  $('summary').textContent = `${valid.length} valid records. ${blank} empty row(s) ignored. Showing up to 10.`;
  preview.hidden = false;
});
function randomCode() {
  const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function safeCsvCell(value) { const text=String(value ?? ''); return /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text; }
function codesCsv() {
  return Papa.unparse(codes.map(r => ({enrollment_number:safeCsvCell(r.enrollment_number),access_code:r.access_code})), {quotes:true});
}
$('download-codes').addEventListener('click', () => {
  if (!codes) return;
  const url = URL.createObjectURL(new Blob(['\uFEFF',codesCsv()], {type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download='tdusa-test-access-codes.csv';
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
  $('code-status').textContent = 'If the download is blocked, select and copy the CSV shown below. Check your Downloads folder before confirming.';
});
$('copy-codes').addEventListener('click', async () => {
  if (!codes) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(codesCsv());
    $('code-status').textContent = 'CSV copied. Paste it into a private text file and save it with a .csv extension.';
  } catch {
    $('code-text').focus(); $('code-text').select();
    $('code-status').textContent = 'Automatic copy was blocked. The text is selected; use your device’s Copy command.';
  }
});
$('confirm-saved').addEventListener('change', e => { codesSaved = e.currentTarget.checked; });
addEventListener('beforeunload', e => { if (importInFlight || (codes && !codesSaved)) { e.preventDefault(); e.returnValue=''; } });
form.addEventListener('submit', async e => {
  e.preventDefault(); if (!candidate || importInFlight || !form.reportValidity()) return;
  importInFlight = true; $('import-button').disabled = true;
  const data = new FormData(form);
  const exam = Object.fromEntries(['exam_name','academic_year','semester','institution','examination_date','access_mode','result_format'].map(k=>[k,String(data.get(k) || '').trim()]));
  codes = candidate.map(record => ({enrollment_number:record.enrollment_number,access_code:randomCode()}));
  const records = candidate.map((record,i)=>({...record,access_code:codes[i].access_code}));
  $('import-button').textContent = 'Saving draft…';
  try {
    const {data: id,error} = await client.rpc('tdusa_import_new_exam',{p_exam:exam,p_file_name:fileInput.files[0].name,p_records:records});
    if (error) throw error;
    $('import-state').textContent = 'Draft saved';
    $('import-detail').textContent = exam.access_mode === 'index_only' ? `${records.length} records saved as a draft. No access code is required; anyone who knows an index can view a published result.` : `${records.length} records saved as a draft. Download the access codes now; they will not be shown again.`;
    await refreshList();
  } catch {
    $('import-state').textContent = 'Import could not be confirmed';
    $('import-detail').textContent = exam.access_mode === 'index_only' ? 'The server response was not confirmed. Check the examination list before retrying; the draft may have been created.' : 'The server response was not confirmed. Save the codes and check the examination list before retrying; the draft may have been created.';
  }
  const needsCodes = exam.access_mode !== 'index_only';
  $('codes-area').hidden = !needsCodes;
  if (needsCodes) $('code-text').value = codesCsv();
  else { codes = null; codesSaved = true; $('code-text').value = ''; }
  form.hidden = true; $('after-import').hidden = false; importInFlight = false;
});
async function regenerateCodes(exam, button) {
  if (importInFlight) return;
  if (codes && !codesSaved) { alert('Save the codes already shown on this page first.'); return; }
  if (!confirm(`Generate new access codes for "${exam.exam_name}"? This invalidates every previous code for this draft. Student records will not be deleted.`)) return;
  importInFlight=true; button.disabled=true; button.textContent='Generating…';
  try {
    const {data,error}=await client.rpc('tdusa_rotate_draft_codes',{p_exam_id:exam.id});
    if (error || !Array.isArray(data) || !data.length) throw new Error('not confirmed');
    codes=data; codesSaved=false; $('confirm-saved').checked=false; $('codes-area').hidden=false;
    $('import-state').textContent='New access codes ready';
    $('import-detail').textContent=`${codes.length} new codes generated for ${exam.exam_name}. Previous codes for this draft no longer work. Save these codes before leaving this page.`;
    $('code-text').value=codesCsv(); $('code-status').textContent='';
    form.hidden=true; $('after-import').hidden=false;
    // Fetch fresh readiness from the server; existing row handlers captured the old state.
    await refreshList();
    $('after-import').scrollIntoView({behavior:'smooth',block:'start'});
  } catch {
    alert('Code generation could not be confirmed. Your results are still saved, but the codes may have changed. Check your connection; generate a fresh set again before distributing any codes.');
  } finally { importInFlight=false; button.disabled=false; button.textContent=exam.codes_ready?'Regenerate codes':'Generate codes'; }
}
async function changeExamMode(exam, button) {
  if(importInFlight)return;
  if(codes && !codesSaved){alert('Save the codes currently shown before changing the access method.');return;}
  const toIndex=exam.access_mode!=='index_only';
  const prompt=toIndex ? `Change "${exam.exam_name}" to INDEX NUMBER ONLY? This is not private: anyone who knows or guesses an index can view a published result.` : `Change "${exam.exam_name}" to require access codes? You must generate and save new codes before publishing.`;
  if(!confirm(prompt))return;
  button.disabled=true;
  try{
    if(!toIndex){const {count,error}=await client.from('student_results').select('id',{count:'exact',head:true}).eq('examination_id',exam.id);if(error||count===null)throw new Error('Could not check result count');if(count>100){alert('Code mode currently supports up to 100 records. This examination remains index-only; do not publish sensitive results in that mode.');return;}}
    const {data,error}=await client.from('examinations').update({access_mode:toIndex?'index_only':'code_required'}).eq('id',exam.id).eq('status','draft').select('id').maybeSingle();
    if(error || !data)throw error || new Error('Draft was changed');
    await refreshList();
    if(!toIndex)alert('Access-code mode selected. Click Generate new codes and save them before publishing.');
  }catch{alert('Could not change the access method. If the examination is published, unpublish it first.');}
  finally{button.disabled=false;}
}
async function changeTestPublication(exam, button) {
  if (importInFlight) return;
  const publish=exam.status==='draft';
  if(publish && codes && !codesSaved){alert('Save the codes shown above and tick the confirmation box before publishing.');return;}
  if(publish && exam.access_mode==='code_required' && !exam.codes_ready){alert('Generate and save new access codes before publishing.');return;}
  const warning=exam.access_mode==='index_only' ? 'WARNING: index-only results are NOT PRIVATE. Anyone who knows or guesses an index number can view a published result.' : 'Anyone with an index number and its access code can view the result.';
  if(!confirm(publish ? `Publish "${exam.exam_name}" to the PUBLIC TEST portal? Only fictional records should be used. ${warning}` : `Unpublish "${exam.exam_name}"? Students will no longer be able to access these results.`))return;
  button.disabled=true;
  try {
    if(publish){const {count,error}=await client.from('student_results').select('id',{count:'exact',head:true}).eq('examination_id',exam.id);if(error||!count){alert('Cannot publish: no records found or the count could not be checked.');return;}}
    const {data,error}=await client.from('examinations').update({status:publish?'published':'draft'}).eq('id',exam.id).eq('status',exam.status).select('id').maybeSingle();
    if(error || !data)throw error || new Error('Status changed');
    await refreshList();
  } catch { alert('Could not update the examination status. Please try again.'); }
  finally {button.disabled=false;}
}
async function refreshList() {
  const body=$('exam-list'); body.replaceChildren();
  const {data,error}=await client.from('examinations').select('id,exam_name,academic_year,status,created_at,access_mode,codes_ready').order('created_at',{ascending:false}).limit(100);
  if (error || !data || !data.length) { const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent=error?'Could not load examinations.': 'No examinations yet.';tr.append(td);body.append(tr);return; }
  data.forEach(exam=>{
    const tr=document.createElement('tr');
    [exam.exam_name,exam.academic_year,exam.status,exam.access_mode==='index_only'?'Index only · not private':(exam.codes_ready?'Index + code':'Index + code · generate codes'),new Date(exam.created_at).toLocaleDateString()].forEach((value,i)=>{const td=document.createElement('td');td.dataset.label=['Examination','Year','Status','Access method','Created'][i];td.textContent=value;tr.append(td)});
    const cell=document.createElement('td');cell.dataset.label='Actions';cell.className='exam-actions-cell';const actions=document.createElement('div');actions.className='exam-actions';
    if(exam.status==='draft') {
      if(exam.access_mode!=='index_only'){const btn=document.createElement('button');btn.type='button';btn.className='secondary-button';btn.textContent=exam.codes_ready?'Regenerate codes':'Generate codes';btn.title=exam.codes_ready?'This replaces all existing codes for this draft.':'Generate codes required for publication.';btn.addEventListener('click',()=>regenerateCodes(exam,btn));actions.append(btn);}
      const mode=document.createElement('button');mode.type='button';mode.className='secondary-button';mode.textContent=exam.access_mode==='index_only'?'Require access code':'Use index only';mode.addEventListener('click',()=>changeExamMode(exam,mode));actions.append(mode);
    }
    const action=document.createElement('button'); action.type='button';action.className='secondary-button';action.textContent=exam.status==='draft'?'Publish test':'Unpublish';action.addEventListener('click',()=>changeTestPublication(exam,action));actions.append(action);cell.append(actions);
    tr.append(cell);body.append(tr);
  });
}
$('refresh-list').addEventListener('click', refreshList);
(async()=>{
 try {
  client=configuredClient(); if (!await checkAdmin(client)) {goLogin();return;}
  $('loading').hidden=true;$('workspace').hidden=false;
  $('logout').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(!error)goLogin();else notice(['Unable to sign out. Please try again.']);});
  await refreshList();
 } catch { $('loading').textContent='Unable to verify administrator access. Check the project configuration and connection.'; }
})();
