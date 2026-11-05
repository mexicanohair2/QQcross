const CACHE_NAME="qqcross-20261105-auth-rack-clues";
const CORE=["./","./index.html","./manifest.json","./styles.css?v=20261105-auth-clues","./app.js?v=20261105-auth-rack-clues","./data/scanword-dictionary.json","./data/scanwords-1000.json"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("qqcross-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==self.location.origin)return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",copy))}return response}).catch(()=>caches.match("./index.html")));
  return;
 }
 if(CORE.some(path=>new URL(path,self.location.href).href===url.href)){
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy))}return response})));
 }
});
