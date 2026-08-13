/* Runs before first paint so the chosen theme never flashes the wrong colours. */
(function(){
  var r=document.documentElement;
  r.classList.add('js');
  var saved=null;
  try{ saved=localStorage.getItem('theme'); }catch(e){}
  r.setAttribute('data-theme',
    (saved==='light'||saved==='dark') ? saved
      : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
})();
