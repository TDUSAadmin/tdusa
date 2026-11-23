import {configuredClient} from './admin/shared.js';
const $=id=>document.getElementById(id), form=$('results-form'), message=$('message'), exam=$('exam'), submit=$('submit');
let client,requestVersion=0;
function invalidateResult(){requestVersion++;$('result-panel').hidden=true;message.textContent='';}
$('index-input').addEventListener('input',invalidateResult);
$('access-code').addEventListener('input',invalidateResult);
async function loadExams(){
  exam.replaceChildren(new Option('Select a published test examination',''));
  const {data,error}=await client.from('examinations').select('id,exam_name,academic_year,institution,access_mode').eq('status','published').order('published_at',{ascending:false}).limit(100);
  if(error){message.textContent='Could not load examinations. Please try again later.';submit.disabled=true;return;}
  if(!data.length){message.textContent='No test examinations are published yet. Ask the administrator to publish a fictional test draft.';submit.disabled=true;return;}
  const labelFor=row=>`${row.exam_name} · ${row.academic_year}${row.institution?' · '+row.institution:''}`;
  const totals=new Map(), seen=new Map();
  data.forEach(row=>totals.set(labelFor(row),(totals.get(labelFor(row))||0)+1));
  data.forEach(row=>{const label=labelFor(row),n=(seen.get(label)||0)+1;seen.set(label,n);const suffix=totals.get(label)>1?` · list ${n} of ${totals.get(label)} (ask admin which stream)`:'';const option=new Option(label+suffix,row.id);option.dataset.accessMode=row.access_mode;exam.add(option);});
  message.textContent='';submit.disabled=false;
  if(data.length===1){exam.value=data[0].id;}
  updateCodeField();
}
function updateCodeField(){
 const selected=exam.selectedOptions[0];
 const hasExam=!!(selected && selected.value);
 const indexOnly=hasExam && selected.dataset.accessMode==='index_only';
 const needsCode=hasExam && !indexOnly;
 $('code-label').hidden=!needsCode;
 $('access-code').disabled=!needsCode;
 $('access-code').required=needsCode;
 $('access-code').value='';
 $('access-method').textContent=!hasExam ? 'Select an examination to see its access requirements.' : indexOnly ? 'Index number only — no access code required.' : 'This examination requires an index number and access code.';
 $('result-panel').hidden=true;message.textContent='';
}
exam.addEventListener('change',()=>{invalidateResult();updateCodeField();});
form.addEventListener('submit',async e=>{
  e.preventDefault(); if(!form.reportValidity())return;
  const version=++requestVersion;submit.disabled=true;message.textContent='Checking…';$('result-panel').hidden=true;
  const cfg=window.TDUSA_SUPABASE_CONFIG;
  try {
    const response=await fetch(`${cfg.url}/functions/v1/tdusa-result-lookup`,{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.publishableKey},body:JSON.stringify({exam_id:exam.value,index:$('index-input').value.trim(),access_code:$('access-code').value}),signal:AbortSignal.timeout(15000)});
    if(version!==requestVersion)return;
    if(response.status===429){message.textContent='Too many attempts. Please wait before trying again.';return;}
    if(response.status===404){message.textContent='Result unavailable. Check your examination, index number and access code.';return;}
    if(!response.ok){message.textContent='The test result service is unavailable. Please try again later.';return;}
    const data=await response.json();
    if(version!==requestVersion)return;
    if(!data || typeof data.result_data!=='object' || data.result_data===null || Array.isArray(data.result_data))throw new Error('Invalid result');
    $('student-name').textContent=data.student_name || 'Student result';
    $('result-index').textContent=`Index number: ${data.index || ''}`;
    const list=$('result-items');list.replaceChildren();
    for(const [subject,value] of Object.entries(data.result_data)){if(subject==='__tdusa_rank'||subject==='__tdusa_zscore'||subject.startsWith('__tdusa_'))continue;const box=document.createElement('div'),name=document.createElement('span'),grade=document.createElement('b');name.textContent=subject;grade.textContent=String(value)===''?'—':String(value);box.append(name,grade);list.append(box);}
    for(const [key,label] of [['__tdusa_rank','Rank'],['__tdusa_zscore','Z-score']]){if(data.result_data[key]!==undefined&&data.result_data[key]!==null){const box=document.createElement('div'),name=document.createElement('span'),value=document.createElement('b');name.textContent=label;value.textContent=String(data.result_data[key]);box.append(name,value);list.append(box);}}
    $('access-code').value=''; message.textContent='';$('result-panel').hidden=false;$('result-panel').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch {if(version===requestVersion)message.textContent='Unable to contact the test service. Please check your connection and try again.';}
  finally{submit.disabled=false;}
});
$('clear-result').addEventListener('click',()=>{invalidateResult();$('result-panel').hidden=true;$('result-items').replaceChildren();$('index-input').value='';$('access-code').value='';$('index-input').focus();});
try{client=configuredClient();loadExams();}catch{submit.disabled=true;message.textContent='Test project is not configured.';}
