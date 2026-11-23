// Test-only: retain all original gallery entries and append published test images.
(async()=>{
 const grid=document.querySelector('#gallery .gallery-grid'); const cfg=window.TDUSA_SUPABASE_CONFIG;
 if(!grid||!cfg?.url||!cfg?.publishableKey)return;
 try{
  const base=new URL('/functions/v1/tdusa-public-gallery',cfg.url);
  const res=await fetch(base,{headers:{apikey:cfg.publishableKey},cache:'no-store',signal:AbortSignal.timeout(10000)});if(!res.ok)return;
  const {images}=await res.json();if(!Array.isArray(images))return;
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('gal-visible');observer.unobserve(e.target);}}),{threshold:0,rootMargin:'0px 0px 200px 0px'}):null;
  images.slice(0,48).forEach(item=>{
   if(!item||typeof item.id!=='string'||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(item.id))return;
   const figure=document.createElement('figure');figure.className='gallery-item gallery-test-image';const img=document.createElement('img');
   const imageUrl=new URL(base);imageUrl.searchParams.set('id',item.id);img.src=imageUrl;img.alt=String(item.description||item.title||'TDUSA gallery image').slice(0,500);img.loading='lazy';img.decoding='async';
   img.addEventListener('error',()=>figure.remove(),{once:true});const caption=document.createElement('figcaption');caption.textContent=String(item.title||'TDUSA gallery').slice(0,200);figure.append(img,caption);grid.append(figure);if(observer)observer.observe(figure);else figure.classList.add('gal-visible');
  });
 }catch{/* Preserve the original gallery if the test service is unavailable. */}
})();
