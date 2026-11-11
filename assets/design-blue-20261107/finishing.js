/* Small, local usability refinements shared by the homepage and the guides. */
(() => {
  const measurementVersion='2026-11-11-m2';
  const sourcePage=document.body.dataset.sourcePage;
  const dialogOrigins=new WeakMap();
  const send=(name,params)=>{
    if(typeof gtag==='function')gtag('event',name,{
      ...params,source_page:sourcePage,measurement_version:measurementVersion
    });
  };
  const position=(element,location=element.dataset.ctaLocation)=>{
    const params={cta_location:location,cta_origin:location};
    if(element.dataset.ctaId)params.cta_id=element.dataset.ctaId;
    return params;
  };
  const opened=(modal,button,extra={})=>{
    const params=position(button);
    dialogOrigins.set(modal,params);
    send('dm_open',{...params,...extra});
  };
  const homeModal=document.getElementById('dmModal');
  const homeOpener='a[onclick*="dmModal"],#navDrawerDm';
  let homeWasOpen=false;
  // Inline handlers open the homepage modal before the bubbling listener runs.
  document.addEventListener('click',event=>{
    if(event.target.closest(homeOpener))homeWasOpen=homeModal?.classList.contains('active');
  },true);
  if(homeModal){
    const clearClosedOrigin=()=>{
      if(!homeModal.classList.contains('active'))dialogOrigins.delete(homeModal);
    };
    new MutationObserver(clearClosedOrigin).observe(homeModal,{attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',clearClosedOrigin);
  }
  // Delegation also covers guide choices parsed later and dynamically inserted chat cards.
  document.addEventListener('click',event=>{
    const target=event.target;
    if(target.closest('[data-cta-nomeasure]'))return;
    if(homeModal&&!homeModal.classList.contains('active'))dialogOrigins.delete(homeModal);
    const opener=target.closest(homeOpener);
    if(opener&&homeModal?.classList.contains('active')&&!homeWasOpen){
      const source=opener.id==='navDrawerDm'?'drawer':opener.classList.contains('nav-dm-btn')?'nav':opener.textContent.trim();
      opened(homeModal,opener,{source});
    }
    const navigation=target.closest('a[data-cta-action="navigate"]');
    if(navigation){
      send('cta_click',{...position(navigation),cta_action:'navigate',destination:navigation.href});
    }
    const link=target.closest('a.contact-method,a.dm-modal-btn,a.u-consult-choice,#sbot-log a.sbot-ct-btn');
    if(!link)return;
    const chat=link.matches('#sbot-log a.sbot-ct-btn');
    const location=chat?'chat':link.dataset.ctaLocation;
    const params=position(link,location);
    if(location==='dialog'){
      const modal=link.closest('#consultDialog,#dmModal');
      if(!modal||(modal.id==='consultDialog'?!modal.open:!modal.classList.contains('active')))return;
      const origin=dialogOrigins.get(modal);
      // Never guess an entrance if the modal was opened by an untracked operation.
      params.cta_origin=origin?.cta_origin||'dialog';
      if(origin?.cta_id)params.cta_id=origin.cta_id;
    }
    const host=new URL(link.href).hostname;
    const channel=host==='line.me'?'line':host==='www.instagram.com'?'instagram':'x';
    params.method=link.dataset.method||(channel==='line'?'store':channel==='instagram'?'instagram_dm':'x_dm');
    params.destination=link.href;
    if(chat){
      params.chat_channel=channel;
      params.chat_cta_trigger=link.closest('.sbot-cta')?.dataset.ctaTrigger||'answer';
    }
    send('contact_click',params);
    send('generate_lead',{...params,link_url:link.href});
  });

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
    if(dialog.open)return;
    try{dialog.showModal()}catch{return}
    if(!dialog.open)return;
    returningFocus=button;bar.hidden=true;
    opened(dialog,button);
  }));
  document.querySelector('.u-consult-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{
    if(dialog.open)return;
    dialogOrigins.delete(dialog);
    returningFocus?.focus({preventScroll:true});returningFocus=null;schedule();
  });
})();
