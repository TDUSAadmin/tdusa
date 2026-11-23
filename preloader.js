// Short, accessible welcome intro. It never waits for external assets.
(()=>{
 const overlay=document.getElementById('welcome-preloader'),typed=document.getElementById('welcome-typed'),first=document.getElementById('welcome-first'),space=document.getElementById('welcome-space'),second=document.getElementById('welcome-second'),skip=document.getElementById('welcome-skip');if(!overlay||!typed||!first||!space||!second||!skip)return;
 if(document.documentElement.classList.contains('tdusa-intro-seen')){try{sessionStorage.setItem('tdusa-welcome-seen','1');}catch(_){}overlay.remove();return;}
 // This is only a tab-local UI preference, never account or result data.
 try{sessionStorage.setItem('tdusa-welcome-seen','1');}catch(_){}
 const text='United by Education. Driven by Excellence.',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,targets=[...document.querySelectorAll('body > header, body > main, body > footer')],focusBefore=document.activeElement;
 const old=targets.map(el=>({el,inert:el.hasAttribute('inert')}));old.forEach(({el})=>el.setAttribute('inert',''));document.body.classList.add('site-intro-active');
 const breakAt='United by Education.'.length;let done=false,typingTimer=null,holdTimer=null,cleanupTimer=null;function paint(i){first.textContent=text.slice(0,Math.min(i,breakAt));space.textContent=i>breakAt?' ':'';second.textContent=text.slice(breakAt+1,i);}paint(reduced?text.length:0);
 function cleanup(){if(!overlay.isConnected)return;overlay.hidden=true;overlay.setAttribute('aria-hidden','true');overlay.remove();old.forEach(({el,inert})=>{if(!inert)el.removeAttribute('inert');});document.body.classList.remove('site-intro-active');window.dispatchEvent(new Event('tdusa:intro-finished'));if(focusBefore&&focusBefore!==document.body&&focusBefore.isConnected&&typeof focusBefore.focus==='function')focusBefore.focus({preventScroll:true});}
 function finish(){if(done)return;done=true;clearTimeout(typingTimer);clearTimeout(holdTimer);clearTimeout(safetyTimer);overlay.classList.add('is-leaving');cleanupTimer=setTimeout(cleanup,reduced?0:450);}
 const safetyTimer=setTimeout(finish,7200);
 // A page restored from the back/forward cache may still contain an intro
 // that was running when the visitor left; remove it immediately on return.
 addEventListener('pageshow',event=>{if(event.persisted&&overlay.isConnected){done=true;clearTimeout(typingTimer);clearTimeout(holdTimer);clearTimeout(safetyTimer);clearTimeout(cleanupTimer);cleanup();}});
 skip.addEventListener('click',finish);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!done){event.preventDefault();finish();}});
 function type(i){if(done)return;paint(i);if(i<text.length)typingTimer=setTimeout(()=>type(i+1),80);else holdTimer=setTimeout(finish,1800);}
 if(reduced)holdTimer=setTimeout(finish,2300);else type(0);
 try{skip.focus({preventScroll:true});}catch{skip.focus();}
})();
