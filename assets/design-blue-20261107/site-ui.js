/* Media controls and keyboard access. */
(() => {
  const video=document.getElementById('heroMovie');
  const cover=document.getElementById('videoCover');
  document.getElementById('playIntro')?.addEventListener('click',()=>{
    cover.hidden=true;video.hidden=false;
    video.play().catch(()=>{});
  });
  const media=[...document.querySelectorAll('audio,video')];
  media.forEach(item=>item.addEventListener('play',()=>media.forEach(other=>{if(other!==item)other.pause()})));
  const modal=document.getElementById('dmModal');
  const close=modal?.querySelector('.dm-modal-close');
  let previousFocus=null;
  document.addEventListener('click',event=>{
    const opener=event.target.closest('a[onclick*="dmModal"],#navDrawerDm');
    if(opener&&modal?.classList.contains('active')){previousFocus=opener;close?.focus()}
    if(event.target===modal||event.target.closest('.dm-modal-close'))previousFocus?.focus();
  });
  modal?.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const focusable=[...modal.querySelectorAll('a,button')];
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal?.classList.contains('active')){modal.classList.remove('active');previousFocus?.focus()}});
  document.querySelector('.sbot-ava')?.replaceChildren(Object.assign(document.createElement('img'),{src:'/assets/design-blue-20261107/shunsuke.png',alt:''}));
})();
