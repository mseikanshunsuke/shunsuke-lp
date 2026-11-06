/* Smaller navigation, with stable document space and all original menus retained. */
(() => {
  const nav=document.querySelector('.site-nav,.g-nav');
  if(!nav)return;
  const root=document.documentElement;
  let compact=false,scheduled=false;
  const measure=()=>{
    nav.classList.remove('r-compact');
    root.style.setProperty('--r-nav-expanded',`${nav.offsetHeight}px`);
    nav.classList.toggle('r-compact',compact);
    root.style.setProperty('--r-nav-current',`${nav.offsetHeight}px`);
  };
  const update=()=>{
    scheduled=false;
    const next=scrollY>180?true:scrollY<60?false:compact;
    if(next!==compact){
      compact=next;nav.classList.toggle('r-compact',compact);
      root.style.setProperty('--r-nav-current',`${nav.offsetHeight}px`);
    }
  };
  addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update)}},{passive:true});
  addEventListener('resize',measure);
  document.fonts?.ready.then(measure);
  measure();update();
})();
