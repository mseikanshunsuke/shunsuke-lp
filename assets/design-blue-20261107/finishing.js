/* Small, local usability refinements shared by the homepage and the guides. */
(() => {
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.voice-card').forEach(card=>{
    const audio=card.querySelector('audio');
    const button=card.querySelector('.u-audio-play');
    const title=card.querySelector('.voice-title')?.textContent.trim();
    const status=card.querySelector('.u-audio-status');
    if(!audio||!button)return;
    const showState=()=>{
      const playing=!audio.paused&&!audio.ended;
      card.classList.toggle('is-playing',playing);
      button.setAttribute('aria-pressed',String(playing));
      button.setAttribute('aria-label',title+(playing?'を一時停止':'を再生'));
      button.querySelector('path').setAttribute('d',playing?'M7 5h4v14H7zm7 0h4v14h-4z':'M9 5v14l11-7z');
    };
    button.addEventListener('click',()=>{
      if(status)status.textContent='';
      if(!audio.paused){audio.pause();return}
      document.querySelectorAll('audio,video').forEach(other=>{if(other!==audio)other.pause()});
      audio.play().catch(()=>{if(status)status.textContent='音声を読み込めませんでした。もう一度お試しください。';showState()});
    });
    ['play','pause','ended','emptied'].forEach(event=>audio.addEventListener(event,showState));
  });

  if(!document.body.classList.contains('u-guide'))return;
  const nav=document.querySelector('.g-nav');
  const hero=document.querySelector('.g-hero');
  const article=document.querySelector('.g-article');
  const cta=document.querySelector('.g-cta');
  const toc=document.querySelector('.u-toc');
  const links=[...document.querySelectorAll('.u-toc nav a')];
  const headings=[...article.querySelectorAll('h2')];
  const progress=document.querySelector('.u-reading-progress span');
  const bar=document.querySelector('.u-mobile-consult');
  const dialog=document.getElementById('consultDialog');
  const wide=matchMedia('(min-width: 1001px)');
  let returningFocus=null,scheduled=false;
  const resizeToc=()=>{toc.open=wide.matches};
  resizeToc();wide.addEventListener('change',resizeToc);
  const render=()=>{
    scheduled=false;
    const navHeight=nav.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--u-guide-nav',`${navHeight}px`);
    const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    progress.style.transform=`scaleX(${Math.max(0,Math.min(1,scrollY/max))})`;
    let current=headings[0]?.id;
    for(const heading of headings){if(heading.getBoundingClientRect().top<navHeight+105)current=heading.id}
    for(const link of links){
      if(link.hash===`#${current}`)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
    bar.hidden=!(innerWidth<=650&&hero.getBoundingClientRect().bottom<navHeight&&cta.getBoundingClientRect().top>innerHeight&&!dialog.open);
    document.querySelectorAll('.g-table-wrap').forEach(table=>table.dataset.overflow=String(table.scrollWidth>table.clientWidth+2));
  };
  const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(render)}};
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
  if(window.ResizeObserver)new ResizeObserver(schedule).observe(nav);
  document.fonts?.ready.then(schedule);render();
  toc.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#"]');
    if(!link)return;
    const target=document.getElementById(link.hash.slice(1));
    if(!target)return;
    event.preventDefault();
    if(!wide.matches)toc.open=false;
    requestAnimationFrame(()=>{
      target.scrollIntoView({behavior:reduce.matches?'auto':'smooth',block:'start'});
      history.replaceState(null,'',link.hash);schedule();
    });
  });
  document.querySelectorAll('[data-consult-open]').forEach(button=>button.addEventListener('click',()=>{
    returningFocus=button;dialog.showModal();bar.hidden=true;
  }));
  document.querySelector('.u-consult-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{returningFocus?.focus({preventScroll:true});schedule()});
})();
