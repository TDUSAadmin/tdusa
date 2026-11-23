import {configuredClient, checkAdmin} from './shared.js';
const $=id=>document.getElementById(id), categories=['gallery','homepage_banner','events','projects','activities','team','other'];
let client, busy=false;
const login=()=>location.replace('login.html');
function message(text){$('message').textContent=text;$('message').hidden=false;}
const dirtyCards=new Set();
function guard(except=null){if(busy){message('Wait for the current operation to finish.');return false;}return true;}
function lockCards(locked){document.querySelectorAll('.media-card input,.media-card select,.media-card button').forEach(el=>{if(locked){el.dataset.lockWasDisabled=el.disabled?'1':'0';el.disabled=true;}else if(el.dataset.lockWasDisabled!==undefined){el.disabled=el.dataset.lockWasDisabled==='1';delete el.dataset.lockWasDisabled;}});}
function snapshots(except){return [...dirtyCards].filter(c=>c!==except).map(c=>({key:c.dataset.recordKey,values:[...c.querySelectorAll('input,select')].map(x=>x.value)}));}
function restore(snap){for(const item of snap){const card=[...document.querySelectorAll('.media-card')].find(c=>c.dataset.recordKey===item.key);if(card){card.querySelectorAll('input,select').forEach((x,i)=>{x.value=item.values[i];});dirtyCards.add(card);}}}
async function refreshPreserving(except){const snap=snapshots(except);try{await refresh();}finally{restore(snap);}}
function input(label,value,type='text') {const l=document.createElement('label');l.textContent=label;const el=document.createElement('input');el.type=type;el.value=value; l.append(el);return [l,el];}
function button(text){const b=document.createElement('button');b.type='button';b.className='secondary-button';b.textContent=text;return b;}
async function refresh(){
 dirtyCards.clear();const {data,error}=await client.from('media').select('id,title,description,storage_path,category,display_order,status,created_at,event_date').order('display_order',{ascending:true}).order('created_at',{ascending:false}).limit(200);
 if(error){message('Could not load images. Existing edits are preserved; try Refresh.');return;}
 $('list').replaceChildren(); if(!data.length){$('list').textContent='No images uploaded yet.';return;}
 for(const m of data){
  const card=document.createElement('article');card.className='media-card';card.dataset.recordKey=m.id;const top=document.createElement('div');top.className='media-preview';const image=document.createElement('img');image.alt=m.title;image.loading='lazy';top.append(image);card.append(top);
  const {data:signed}=await client.storage.from('tdusa-media').createSignedUrl(m.storage_path,600);if(signed?.signedUrl) image.src=signed.signedUrl; else {top.textContent='Preview unavailable';}
  const fields=document.createElement('div');fields.className='media-fields';const [tl,title]=input('Title',m.title),[dl,desc]=input('Description',m.description),[ol,order]=input('Display order',m.display_order,'number'),[dateLabel,eventDate]=input('Event date (optional)',m.event_date||'','date');title.required=true;title.maxLength=200;desc.maxLength=500;order.min='-100000';order.max='100000';
  const catLabel=document.createElement('label');catLabel.textContent='Category';const cat=document.createElement('select');for(const c of categories){const opt=document.createElement('option');opt.value=c;opt.textContent=c.replaceAll('_',' ');cat.append(opt);}cat.value=m.category;catLabel.append(cat);fields.append(tl,dl,catLabel,ol,dateLabel);
  const state=document.createElement('p');state.className='hint';state.textContent=`Status: ${m.status}. Published Gallery images and Event posters appear on the test website.`;
  const actions=document.createElement('div');actions.className='media-actions';const save=button('Save changes'), toggle=button(m.status==='draft'?'Mark published':'Return to draft'),remove=button('Delete');const discard=button('Discard edits');actions.append(save,toggle,remove,discard);fields.append(state,actions);card.append(fields);$('list').append(card);fields.addEventListener('input',()=>dirtyCards.add(card));fields.addEventListener('change',()=>dirtyCards.add(card));discard.onclick=()=>{if(busy||!dirtyCards.has(card))return;if(!confirm('Discard unsaved changes on this image?'))return;title.value=m.title;desc.value=m.description||'';cat.value=m.category;order.value=m.display_order;eventDate.value=m.event_date||'';dirtyCards.delete(card);message('Image edits discarded.');};if(busy){card.querySelectorAll('input,select,button').forEach(el=>{el.dataset.lockWasDisabled=el.disabled?'1':'0';el.disabled=true;});}
  save.onclick=async()=>{if(!guard(card))return;const n=Number(order.value),t=title.value.trim();if(!t||t.length>200||desc.value.length>500||order.value.trim()===''||!Number.isInteger(n)||n < -100000||n >100000){message('Enter a title and a whole display-order number between -100000 and 100000.');return;}busy=true;lockCards(true);try{const {data,error}=await client.from('media').update({title:t,description:desc.value.trim(),category:cat.value,display_order:n,event_date:eventDate.value||null}).eq('id',m.id).select('id').maybeSingle();if(error||!data)message('Could not save image details. Please refresh and retry.');else {message('Image details saved.');await refreshPreserving(card);}}catch{message('Could not confirm image save. Refresh and check before retrying.');}finally{busy=false;lockCards(false);}};
  toggle.onclick=async()=>{if(!guard(card))return;if(dirtyCards.has(card)){message('Save image changes before changing its publication status.');return;}busy=true;lockCards(true);try{const {data,error}=await client.from('media').update({status:m.status==='draft'?'published':'draft'}).eq('id',m.id).eq('status',m.status).select('id').maybeSingle();if(error||!data)message('Could not update the status. Refresh and try again.');else {message('Status updated. Published Gallery images and Event posters appear on the test website.');await refreshPreserving(card);}}catch{message('Could not confirm image status. Refresh and check before retrying.');}finally{busy=false;lockCards(false);}};
  remove.onclick=async()=>{if(!guard(card))return;if(!confirm(`Delete “${m.title}” and its stored image? This cannot be undone. Any linked content may lose this image.`))return;busy=true;lockCards(true);try{
   // First remove public visibility, so a later partial failure cannot leave a publicly broken published entry.
   if(m.status==='published'){const {data,error}=await client.from('media').update({status:'draft'}).eq('id',m.id).eq('status','published').select('id').maybeSingle();if(error||!data){message('Could not confirm unpublishing. The stored image was not deleted. Refresh and retry.');return;}m.status='draft';state.textContent='Status: draft. This image is not public.';toggle.textContent='Mark published';}
   const {error:storageError}=await client.storage.from('tdusa-media').remove([m.storage_path]);if(storageError){message('Image is a draft; its file could not be removed. Retry Delete.');return;}
   const {error:dbError}=await client.from('media').delete().eq('id',m.id);if(dbError)message('Image is a private draft. The file was removed but its record remains; retry Delete to clean up.');else message('Image deleted.');await refreshPreserving(card);
  }catch{message('Deletion could not be confirmed. Refresh Images and check before retrying; the image may be a draft.');}finally{busy=false;lockCards(false);}};
 }
}
$('upload-form').onsubmit=async e=>{e.preventDefault();if(!guard())return;const f=e.currentTarget,file=$('image').files[0],fd=new FormData(f),title=String(fd.get('title')).trim(),description=String(fd.get('description')).trim(),order=Number(fd.get('display_order')),category=String(fd.get('category')),eventDate=String(fd.get('event_date')||'');
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size===0||file.size>10485760||!title||title.length>200||description.length>500||!categories.includes(category)||String(fd.get('display_order')).trim()===''||!Number.isInteger(order)||order < -100000||order > 100000){message('Check the title, display order, and image type and size (JPEG, PNG or WebP; maximum 10 MB).');return;}
 busy=true;lockCards(true);const submit=f.querySelector('button[type=submit]');submit.disabled=true;const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=`uploads/${crypto.randomUUID()}.${ext}`;
 try{const {error:uploadError}=await client.storage.from('tdusa-media').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw Error('Upload failed. Please check your connection and try again.');
  const {error:insertError}=await client.from('media').insert({title,description,category,display_order:order,event_date:eventDate||null,storage_path:path,status:'draft'});
  if(insertError){const {data:existing,error:checkError}=await client.from('media').select('id').eq('storage_path',path).maybeSingle();if(checkError)throw Error('The image upload was not confirmed. Refresh the list before retrying; an administrator may need to check storage for an unused file.');if(!existing){const {error:cleanupError}=await client.storage.from('tdusa-media').remove([path]);throw Error(cleanupError?'The record was not saved and the uploaded file could not be cleaned up. An administrator must check storage.':'The image record could not be saved. The uploaded file was removed; please retry.');}}
  f.reset();message('Draft image uploaded. Drafts do not appear on the test website.');await refreshPreserving(null);
 }catch(err){message(err.message||'Upload could not be confirmed. Refresh the list before retrying.');}finally{busy=false;lockCards(false);submit.disabled=false;}
};
// Upload a numbered set through the signed-in admin account and existing RLS.
// Stop at the first unconfirmed response; never silently repeat a partial batch.
const batchForm=$('batch-form'),batchImages=$('batch-images'),batchSubmit=$('batch-submit');
let batchNeedsReview=false;
const sortedBatch=()=>[...batchImages.files].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
batchImages.addEventListener('change',()=>{const files=sortedBatch();$('batch-selection').textContent=files.length?`${files.length} selected: ${files.map(f=>f.name).join(', ')}`:'Choose up to 48 JPEG, PNG or WebP images, each up to 10 MB.';});
function batchMessage(text){$('batch-message').textContent=text;$('batch-message').hidden=false;}
batchForm.onsubmit=async e=>{
 e.preventDefault();if(!guard()||batchNeedsReview)return;
 const files=sortedBatch(),startRaw=$('batch-start').value,start=Number(startRaw),publish=$('batch-publish').checked;
 if(!files.length||files.length>48||startRaw.trim()===''||!Number.isInteger(start)||start< -100000||start+files.length-1>100000||files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||!f.size||f.size>10485760||f.name.replace(/\.[^.]+$/,'').trim().length>190)||new Set(files.map(f=>f.name.toLowerCase())).size!==files.length){batchMessage('Choose 1–48 differently named JPEG, PNG or WebP files under 10 MB each, and a valid starting order.');return;}
 if(publish&&!confirm(`Publish ${files.length} event posters to all websites connected to this test project?`))return;
 busy=true;lockCards(true);batchForm.querySelectorAll('input,button').forEach(el=>el.disabled=true);$('batch-progress').replaceChildren();let complete=0,needsReview=false;
 try{
  for(let i=0;i<files.length;i++){
   const file=files[i],base=file.name.replace(/\.[^.]+$/,'').trim()||`Poster ${i+1}`,title=/^\d+$/.test(base)?`Poster ${base}`:base,ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=`uploads/${crypto.randomUUID()}.${ext}`;
   const entry=document.createElement('li');entry.textContent=`${file.name}: uploading…`;$('batch-progress').append(entry);batchMessage(`Uploading ${i+1} of ${files.length}. Please keep this page open.`);
   try{
    const upload=await client.storage.from('tdusa-media').upload(path,file,{contentType:file.type,upsert:false});if(upload.error)throw Error('Upload could not be confirmed.');
    const record={title,description:'',category:'events',display_order:start+i,event_date:null,storage_path:path,status:'draft'};
    const inserted=await client.from('media').insert(record).select('id').maybeSingle();
    if(inserted.error||!inserted.data?.id){
      const checked=await client.from('media').select('id').eq('storage_path',path).maybeSingle();
      if(checked.error||!checked.data?.id)throw Error('The image record could not be confirmed. A private uploaded file may need cleanup.');
      inserted.data=checked.data;
    }
    if(publish){const result=await client.from('media').update({status:'published'}).eq('id',inserted.data.id).eq('status','draft').select('id').maybeSingle();if(result.error||!result.data?.id)throw Error('Publication could not be confirmed. Check this image in Existing images before trying again.');}
    complete++;entry.textContent=`${file.name}: ${publish?'published':'saved as draft'} (order ${start+i})`;
   }catch(err){needsReview=true;entry.textContent=`${file.name}: stopped — ${err.message||'operation could not be confirmed'}`;break;}
  }
  if(needsReview){batchNeedsReview=true;batchMessage(`Stopped after ${complete} of ${files.length} were confirmed. Check Existing images before retrying so you do not create duplicates. Some files may be drafts or require storage cleanup.`);}
  else {batchForm.reset();$('batch-selection').textContent='Choose up to 48 JPEG, PNG or WebP images, each up to 10 MB.';batchMessage(`Done: ${complete} event posters ${publish?'published':'saved as drafts'} in filename order.`);}
  await refreshPreserving(null);
 }catch{batchNeedsReview=true;batchMessage(`Could not confirm the batch. ${complete} completed. Refresh Existing images and check before retrying to avoid duplicates.`);}
 finally{busy=false;lockCards(false);batchForm.querySelectorAll('input,button').forEach(el=>el.disabled=batchNeedsReview);}
};
$('refresh').onclick=async()=>{if(busy){message('Wait for the current operation to finish.');return;}if(dirtyCards.size&&!confirm('Discard all unsaved image changes and refresh?'))return;busy=true;lockCards(true);try{await refresh();}finally{busy=false;lockCards(false);}};
addEventListener('beforeunload',e=>{if(dirtyCards.size||busy){e.preventDefault();e.returnValue='';}});
(async()=>{try{client=configuredClient();if(!await checkAdmin(client)){login();return;}$('loading').hidden=true;$('workspace').hidden=false;$('logout').onclick=async()=>{if(busy){message('Wait for the current operation to finish.');return;}if(dirtyCards.size&&!confirm('Discard unsaved image changes and sign out?'))return;const {error}=await client.auth.signOut();if(error)message('Could not sign out.');else login();};await refresh();}catch{$('loading').textContent='Unable to verify administrator access. Check the connection and project configuration.';}})();
