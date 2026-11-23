// Test-only managed committee. Keep the original HTML if no published term exists.
(async()=>{
 const cfg=window.TDUSA_SUPABASE_CONFIG, grid=document.querySelector('#team .committee-grid');if(!cfg?.url||!cfg?.publishableKey||!grid)return;
 try{
  const url=new URL('/rest/v1/committee_terms',cfg.url);url.search=new URLSearchParams({select:'year_label,members',status:'eq.published',limit:'1'});
  const response=await fetch(url,{headers:{apikey:cfg.publishableKey},cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)return;const list=await response.json();const term=list?.[0];if(!term||!Array.isArray(term.members)||!term.members.length)return;
  const frag=document.createDocumentFragment();
  term.members.slice(0,100).forEach((m,i)=>{if(!m||typeof m.name!=='string'||typeof m.position!=='string')return;
   const card=document.createElement('article');card.className='member-card';const photo=document.createElement('div');photo.className='member-photo';
   let photoSrc='';if(typeof m.photo_id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(m.photo_id)){const link=new URL('/functions/v1/tdusa-public-gallery',cfg.url);link.searchParams.set('type','team');link.searchParams.set('id',m.photo_id);photoSrc=link.href;}else if(typeof m.legacy_photo==='string'&&/^public\/committee-2026\/[A-Za-z0-9_-]+\.webp$/.test(m.legacy_photo)){photoSrc=m.legacy_photo;}
   if(photoSrc){const img=document.createElement('img');img.src=photoSrc;img.alt=`${m.name}, ${m.position}`;img.loading='lazy';img.decoding='async';img.addEventListener('error',()=>img.remove(),{once:true});photo.append(img);}
   const info=document.createElement('div');info.className='member-info';for(const [tag,text] of [['span',`${String(i+1).padStart(2,'0')} / ${m.group||'Committee'}`],['h3',m.name],['p',m.position],['b',m.institution||'']]){const el=document.createElement(tag);el.textContent=String(text).slice(0,150);info.append(el);}card.append(photo,info);frag.append(card);
  });
  if(!frag.childElementCount)return;grid.replaceChildren(frag);const title=document.querySelector('#team > .section-label span');if(title)title.textContent=`${String(term.year_label).slice(0,40)} executive committee`;const intro=document.querySelector('#team .committee-intro span');if(intro)intro.textContent=`TDUSA / ${String(term.year_label).slice(0,40)}`;const description=document.querySelector('#team .team-layout p');if(description)description.textContent=description.textContent.replace(/Meet the 2026 TDUSA Executive Committee/i,`Meet the ${String(term.year_label).slice(0,40)} TDUSA Executive Committee`);
 }catch{/* Preserve original committee on network or configuration failure. */}
})();
