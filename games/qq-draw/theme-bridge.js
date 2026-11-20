(function(){
  function sync(){try{
    const root=document.documentElement,host=parent.document.documentElement,style=parent.getComputedStyle(host);
    root.dataset.qqTheme=host.dataset.qqTheme||"burgundy";root.dataset.qqMode=host.dataset.qqMode||"dark";
    const map={"--bg":"--qq-theme-page","--surface":"--qq-theme-card","--surface-2":"--qq-theme-panel","--line":"--qq-theme-border","--accent":"--qq-theme-accent","--accent-2":"--qq-theme-accent","--text":"--qq-theme-text","--muted":"--qq-theme-muted"};
    for(const [target,source] of Object.entries(map)){const value=style.getPropertyValue(source).trim();if(value)root.style.setProperty(target,value)}
  }catch(_){}}
  sync();try{new MutationObserver(sync).observe(parent.document.documentElement,{attributes:true,attributeFilter:["data-qq-theme","data-qq-mode"]});}catch(_){}
  window.addEventListener("storage",sync);
})();