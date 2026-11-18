'use strict';
const DB_NAME='smart-wardrobe-v01', STORE='items';let db,items=[],page='home',filter='全部',showWishlist=false;
let orderDraft=[],orderOCRBusy=false,orderOCRStatus='';
let studioAvatar=null,studioLayers=[],studioCategory='上衣',studioActive=null;const studioCategories=['上衣','褲裝','裙裝','洋裝','外套','鞋子','帽子','襪子／褲襪','飾品','其他配件'];
const starter=[
['SW-D001','深色短袖針織洋裝','洋裝','深色','韓系簡約','all','合身上半身、微 A 字裙擺、短袖'],
['SW-T001','白色帽 T','上衣','白色','日系休閒','cool','寬鬆，較涼天氣'],
['SW-P001','淺藍色牛仔長褲','褲裝','淺藍','日系休閒','all','鬆緊腰、高腰、直筒微收窄'],
['SW-P002','深藍色牛仔長褲','褲裝','深藍','日系簡約','all','鬆緊腰、深藍水洗、偏直筒'],
['SW-P003','灰黑色水洗寬版牛仔褲','褲裝','灰黑','日系休閒','all','腰部偏鬆，必須搭配 SW-A001 米白色編織皮帶'],
['SW-P004','灰色棉褲','褲裝','灰色','休閒','all','寬鬆休閒'],
['SW-O001','黑色厚外套','外套','黑色','休閒','cool','寬鬆、保暖'],
['SW-S001','白色球鞋','鞋子','白色','百搭','all','休閒'],
['SW-H001','淺藍 BOSTON 棒球帽','帽子','淺藍','休閒','warm','淺藍色'],
['SW-H002','adidas 米白棒球帽','帽子','米白','休閒','warm','深色 Logo'],
['SW-H003','米白針織帽','帽子','米白','休閒','cool','保暖'],
['SW-H004','Nike 深灰針織帽','帽子','深灰','休閒','cool','白色 Logo'],
['SW-A001','米白色編織皮帶','其他配件','米白','百搭','all','SW-P003 必要配件']
].map(([id,name,category,color,style,season,notes])=>({id,name,category,color,style,season,notes,status:'owned'}));
// v0.2.2: 以 SVG 示意圖測試沒有照片的衣物，不代表實物版型。
function sampleArt(x){
 const colors={'白':'#eeeae1','米白':'#e9e2d5','淺藍':'#a8c8dd','深藍':'#526b91','灰黑':'#555963','深灰':'#686b75','灰':'#a4a6ae','黑':'#373b43'};
 const color=Object.entries(colors).find(([k])=>(x.color||'').includes(k))?.[1]||'#b7c7d4';
 const type=x.category;let shape='';
 if(type==='褲裝')shape='<path d="M34 15H86L92 107H65L60 51 55 107H28Z"/>';
 else if(type==='裙裝')shape='<path d="M41 16H79L99 105H21Z"/>';
 else if(type==='洋裝')shape='<path d="M40 12L25 31 38 48 40 57 21 107H99L80 57 82 48 95 31 80 12 67 18 53 18Z"/>';
 else if(type==='鞋子')shape='<path d="M12 68Q26 59 39 60L55 76 84 79Q103 82 106 97H12Z"/>';
 else if(type==='帽子')shape='<path d="M27 66Q25 22 60 22Q95 22 93 66Z M16 68Q60 54 106 68L103 79H17Z"/>';
 else if(type==='其他配件')shape='<path d="M10 52H110V68H10Z M51 44H70V77H51Z"/>';
 else shape='<path d="M39 13L16 32 29 58 40 51 39 108H81L80 51 91 58 104 32 81 13 69 20 51 20Z"/>';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="${shape.match(/d="([^"]+)/)?.[1]||''}" fill="${color}" stroke="#647586" stroke-width="2" stroke-linejoin="round"/><text x="60" y="117" text-anchor="middle" font-size="8" fill="#53677b">示意圖</text></svg>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
const visual=x=>x?.photo||sampleArt(x);
// 本機去背：適合單純背景，提供容差與柔化邊緣；不是 AI 人像分割。
async function removePlainBackground(src,tolerance=38,feather=16){
 const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);const frame=ctx.getImageData(0,0,c.width,c.height),a=frame.data,w=c.width,h=c.height;
 const points=[[0,0],[w-1,0],[0,h-1],[w-1,h-1],[Math.floor(w/2),0],[Math.floor(w/2),h-1],[0,Math.floor(h/2)],[w-1,Math.floor(h/2)]];
 const rgb=points.map(([x,y])=>{let i=(y*w+x)*4;return [a[i],a[i+1],a[i+2]]});
 // Use the most consistent corner/background cluster, avoiding one corner occupied by clothing.
 let best=rgb[0],bestScore=-1;for(const v of rgb){let score=rgb.filter(u=>Math.hypot(...u.map((z,k)=>z-v[k]))<35).length;if(score>bestScore){bestScore=score;best=v}}
 const bg=[0,1,2].map(k=>{let near=rgb.filter(v=>Math.hypot(...v.map((z,j)=>z-best[j]))<35);return near.reduce((sum,v)=>sum+v[k],0)/near.length});
 const dist=n=>{let i=n*4;return Math.hypot(a[i]-bg[0],a[i+1]-bg[1],a[i+2]-bg[2])/Math.sqrt(3)};
 const seen=new Uint8Array(w*h),stack=[];for(let x=0;x<w;x++){stack.push(x,(h-1)*w+x)}for(let y=0;y<h;y++){stack.push(y*w,y*w+w-1)}
 // Flood fill only from image edges, so enclosed clothing regions are preserved.
 while(stack.length){const n=stack.pop();if(seen[n])continue;seen[n]=1;const d=dist(n);if(d>tolerance+feather)continue;
  const i=n*4;a[i+3]=d<=tolerance?0:Math.round(255*(d-tolerance)/Math.max(1,feather));
  const x=n%w,y=(n/w)|0;if(x>0)stack.push(n-1);if(x<w-1)stack.push(n+1);if(y>0)stack.push(n-w);if(y<h-1)stack.push(n+w);
 }
 ctx.putImageData(frame,0,0);return c.toDataURL('image/png');
}
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=> 'SW-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
function openDB(){return new Promise((res,rej)=>{let r=indexedDB.open(DB_NAME,2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});if(!r.result.objectStoreNames.contains('history'))r.result.createObjectStore('history',{keyPath:'id'});if(!r.result.objectStoreNames.contains('studio'))r.result.createObjectStore('studio',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function transaction(store,mode,fn){return new Promise((res,rej)=>{const t=db.transaction(store,mode),s=t.objectStore(store);let r=fn(s);t.oncomplete=()=>res(r?.result);t.onerror=()=>rej(t.error)})}
const all=store=>transaction(store,'readonly',s=>s.getAll());const put=(store,value)=>transaction(store,'readwrite',s=>s.put(value));const del=(store,id)=>transaction(store,'readwrite',s=>s.delete(id));
async function load(){items=await all(STORE);render()}
const owned=()=>items.filter(x=>x.status==='owned');const pick=(category,exclude=[])=>owned().filter(x=>x.category===category&&!exclude.includes(x.id));
function seasonMatch(x,season){return x.season==='all'||x.season===season}
function outfits(){const season=localStorage.getItem('sw-season')||'cool';const tops=pick('上衣').filter(x=>seasonMatch(x,season));const bottoms=pick('褲裝');const dresses=pick('洋裝');const shoes=pick('鞋子');const outer=pick('外套').filter(x=>seasonMatch(x,season));const hats=pick('帽子').filter(x=>seasonMatch(x,season));let combos=[];const add=(label,ids,why)=>{ids=[...new Set(ids.filter(Boolean))];if(ids.length<2)return;const p=items.find(x=>x.id==='SW-P003');if(p&&ids.includes(p.id)){let belt=items.find(x=>x.id==='SW-A001'&&x.status==='owned');if(!belt)return;ids.push(belt.id)}combos.push({label,ids:[...new Set(ids)],why})};
const top=tops[0],pants=bottoms[0],shoe=shoes[0],jacket=outer[0];
add('A｜舒適休閒', [top?.id,pants?.id,shoe?.id,season==='cool'?jacket?.id:hats[0]?.id], '以舒適、好活動的單品為主；天氣較涼時加上外套。');
add('B｜修身質感',[dresses[0]?.id,shoe?.id,season==='cool'?jacket?.id:null], '選擇有腰線的短袖洋裝，避免單穿會露出腋下的款式。');
add('C｜風格變化',[tops[0]?.id,bottoms.find(x=>x.id==='SW-P003')?.id||bottoms[1]?.id,shoe?.id,hats[0]?.id], '利用寬版褲與帽子做出日系層次；寬褲會自動附上必要皮帶。');
// Only use owned pieces. Reject sleeveless items without a suitable covering layer.
return combos.filter(c=>!c.ids.some(id=>{
 const x=items.find(v=>v.id===id);
 if(!x||!/無袖|掛脖|露腋下/.test(x.notes+' '+x.name))return false;
 const covered=c.ids.some(z=>{
  const y=items.find(v=>v.id===z);
  return y&&((y.category==='上衣'&&/短袖|長袖/.test(y.notes+' '+y.name))||(y.category==='外套'&&/遮腋下/.test(y.notes)));
 });
 return !covered;
}));}

// Weather preferences persist on this device. Geolocation is requested only after opt-in.
// 個人檔案存於既有 IndexedDB studio store，備份時與衣櫃一起匯出。
const PROFILE_DEFAULT={height:'161',weight:'47',waist:'25',topSize:'S–M',coatSize:'M–L',styles:['日系簡約','韓系清新','學院風'],restrictions:['不露腋下'],preferences:['偏好外套','寬鬆與修身皆可'],photo:null};
const PROFILE_STYLES=['日系簡約','韓系清新','學院風','舒適休閒','俐落修身','日系 City Boy','韓系街頭','極簡中性','復古文青','甜美溫柔','法式優雅','都會通勤','運動休閒','美式休閒','戶外機能'];
const PROFILE_RESTRICTIONS=['不露腋下','不穿無袖','不穿短裙','避免貼身上衣','不穿露肩','不穿低領','不穿短版上衣','不穿露背','避免過短褲裙','避免過透材質','不穿高跟鞋','避免過緊褲裝','避免厚重衣物','避免容易皺的材質'];
const PROFILE_PREFERENCES=['偏好外套','寬鬆與修身皆可','喜歡層次穿搭','偏好長褲','偏好高腰','偏好寬褲','偏好裙裝','喜歡針織','偏好素色','喜歡低飽和配色','偏好舒適好活動','重視顯高比例','偏好球鞋','喜歡靴子','偏好可重複搭配單品','喜歡帽子或配件'];
let profile={...PROFILE_DEFAULT},profileEditing=false;
function readProfile(record){const p=record&&typeof record==='object'?record:{};return {...PROFILE_DEFAULT,...p,styles:Array.isArray(p.styles)?p.styles:PROFILE_DEFAULT.styles,restrictions:Array.isArray(p.restrictions)?p.restrictions:PROFILE_DEFAULT.restrictions,preferences:Array.isArray(p.preferences)?p.preferences:PROFILE_DEFAULT.preferences};}
function profileChips(arr){return arr.length?arr.map(x=>`<span class="pill">${esc(x)}</span>`).join(''):'<span class="muted">尚未設定</span>'}
function profileOptions(name,options,chosen){
 const custom=chosen.filter(x=>!options.includes(x));
 return `<div class="profile-options">${options.map(v=>`<label class="profile-choice"><input type="checkbox" name="${name}" value="${esc(v)}" ${chosen.includes(v)?'checked':''}><span>${esc(v)}</span></label>`).join('')}</div>
 <div class="profile-other"><label class="profile-choice"><input type="checkbox" data-other-toggle="${name}" ${custom.length?'checked':''}><span>其他（自行輸入）</span></label><input class="profile-other-input" data-other-input="${name}" type="text" maxlength="180" placeholder="輸入自訂選項，多項可用逗號分隔" value="${esc(custom.join('、'))}" ${custom.length?'':'disabled'}></div>`;
}
function readProfileForm(form){const fd=new FormData(form),next={...profile};for(const k of ['height','weight','waist','topSize','coatSize'])next[k]=String(fd.get(k)||'').trim();for(const k of ['styles','restrictions','preferences']){
 const standard=fd.getAll(k).map(x=>String(x).trim());const toggle=form.querySelector(`[data-other-toggle="${k}"]`);const input=form.querySelector(`[data-other-input="${k}"]`);
 const custom=toggle?.checked?(input?.value||'').split(/[、,，;；\n]+/).map(x=>x.trim()).filter(Boolean):[];
 next[k]=[...new Set([...standard,...custom])];
 }return next;}
function profileGroup(title,name,options,chosen,editing){return `<div class="profile-group"><strong>${title}</strong>${editing?profileOptions(name,options,chosen):`<div class="profile-tags">${profileChips(chosen)}</div>`}</div>`;}
function profileHTML(){const p=profile;const photo=`<div class="profile-photo-area"><div class="profile-photo">${p.photo?`<img src="${p.photo}" alt="個人照片">`:'<span aria-hidden="true">♙</span>'}</div>${profileEditing?`<button type="button" class="small-btn secondary profile-edit-photo" id="profileAdjustPhoto">${p.photo?'編輯相片':'新增相片'}</button>`:'<span class="muted">個人照片</span>'}</div>`;
 const fields=profileEditing?`<div class="profile-fields"><label>身高（cm）<input name="height" type="number" min="80" max="230" step="0.1" value="${esc(p.height)}"></label><label>體重（kg）<input name="weight" type="number" min="10" max="300" step="0.1" value="${esc(p.weight)}"></label><label>腰圍（吋）<input name="waist" type="number" min="15" max="70" step="0.1" value="${esc(p.waist)}"></label><label>上衣尺寸<input name="topSize" maxlength="30" value="${esc(p.topSize)}"></label><label>外套尺寸<input name="coatSize" maxlength="30" value="${esc(p.coatSize)}"></label></div>`:`<div class="profile-summary"><div><span>身高</span><strong>${esc(p.height||'—')} cm</strong></div><div><span>體重</span><strong>${esc(p.weight||'—')} kg</strong></div><div><span>腰圍</span><strong>${esc(p.waist||'—')} 吋</strong></div><div><span>上衣</span><strong>${esc(p.topSize||'—')}</strong></div><div><span>外套</span><strong>${esc(p.coatSize||'—')}</strong></div></div>`;
 return `<div class="section-head"><h2>個人檔案</h2><button type="button" class="small-btn secondary" id="profileEditBtn">${profileEditing?'取消編輯':'編輯'}</button></div><section class="card profile-card">${profileEditing?'<form id="profileForm" class="profile-form">':''}<div class="profile-top">${photo}${fields}</div><div class="profile-lower">${profileGroup('喜好風格','styles',PROFILE_STYLES,p.styles,profileEditing)}${profileGroup('穿著限制','restrictions',PROFILE_RESTRICTIONS,p.restrictions,profileEditing)}${profileGroup('穿搭偏好','preferences',PROFILE_PREFERENCES,p.preferences,profileEditing)}</div>${profileEditing?'<button type="submit" class="profile-save">儲存個人設定</button><p class="notice">個人照片僅儲存在本機瀏覽器，不會上傳至 GitHub。</p></form>':''}</section>`;
}
async function saveProfile(){await put('studio',{id:'profile',...profile})}
// Profile photo: one shared square viewport for touch preview and saved output.
let portraitState=null;
const portraitCanvas=$('#portraitCanvas'),portraitDialog=$('#portraitDialog');
function openPortraitEditor(source){
 const im=new Image();im.onload=()=>{
  const size=portraitCanvas.width,base=Math.max(size/im.naturalWidth,size/im.naturalHeight);
  portraitState={im,base,zoom:1,x:0,y:0,pointers:new Map(),lastDistance:0};
  drawPortrait();portraitDialog.showModal();
 };im.onerror=()=>alert('無法讀取這張照片');im.src=source;
}
function drawPortrait(){const st=portraitState;if(!st)return;
 const c=portraitCanvas,ctx=c.getContext('2d'),size=c.width;
 const w=st.im.naturalWidth*st.base*st.zoom,h=st.im.naturalHeight*st.base*st.zoom;
 st.x=Math.max((size-w)/2,Math.min((w-size)/2,st.x));
 st.y=Math.max((size-h)/2,Math.min((h-size)/2,st.y));
 ctx.clearRect(0,0,size,size);ctx.drawImage(st.im,(size-w)/2+st.x,(size-h)/2+st.y,w,h);
}
function setPortraitZoom(v){if(!portraitState)return;portraitState.zoom=Math.max(1,Math.min(4,Number(v)));drawPortrait()}
async function profilePhotoFile(file){if(!file)return;try{
 const photo=await compressPhoto(file);if(profileEditing){const f=$('#profileForm');if(f)profile=readProfileForm(f)}
 // Keep original photo locally so later edits can recover content outside the crop.
 profile.photoOriginal=photo;openPortraitEditor(photo);
 }catch(err){alert('照片無法讀取：'+err.message)}}
$('#portraitReplace').addEventListener('click',()=>$('#portraitFileInput').click());
$('#portraitFileInput').addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';if(file)profilePhotoFile(file)});
portraitCanvas.addEventListener('pointerdown',e=>{if(!portraitState)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);portraitState.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});portraitState.lastDistance=0});
portraitCanvas.addEventListener('pointermove',e=>{const st=portraitState;if(!st||!st.pointers.has(e.pointerId))return;e.preventDefault();const prev=st.pointers.get(e.pointerId);st.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const points=[...st.pointers.values()];if(points.length===1){const rect=e.currentTarget.getBoundingClientRect();st.x+=(e.clientX-prev.x)*360/rect.width;st.y+=(e.clientY-prev.y)*360/rect.height;drawPortrait()}else if(points.length===2){const d=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);if(st.lastDistance)setPortraitZoom(st.zoom*d/st.lastDistance);st.lastDistance=d}});
for(const name of ['pointerup','pointercancel','lostpointercapture'])portraitCanvas.addEventListener(name,e=>{if(!portraitState)return;portraitState.pointers.delete(e.pointerId);portraitState.lastDistance=0});
portraitCanvas.addEventListener('wheel',e=>{e.preventDefault();if(portraitState)setPortraitZoom(portraitState.zoom*(e.deltaY>0?.94:1.06))},{passive:false});
$('#portraitCancel').addEventListener('click',()=>{portraitDialog.close();portraitState=null});
$('#portraitRemove').addEventListener('click',async()=>{if(!confirm('確定移除個人照片？'))return;try{if(profileEditing){const f=$('#profileForm');if(f)profile=readProfileForm(f)}profile.photo=null;profile.photoOriginal=null;await saveProfile();portraitDialog.close();portraitState=null;render()}catch(err){alert('移除失敗：'+err.message)}});
$('#portraitSave').addEventListener('click',async()=>{if(!portraitState)return;try{const photo=portraitCanvas.toDataURL('image/jpeg',.9);if(profileEditing){const f=$('#profileForm');if(f)profile=readProfileForm(f)}profile.photo=photo;await saveProfile();portraitDialog.close();portraitState=null;render()}catch(err){alert('照片儲存失敗：'+err.message)}});
const WX_PREF='sw-weather-preferences-v1';
const WX_CITIES={hsinchu:{lat:24.8138,lon:120.9675,name:'新竹市'},zhubei:{lat:24.8387,lon:121.0043,name:'竹北市'},taipei:{lat:25.033,lon:121.5654,name:'台北市'},taichung:{lat:24.1477,lon:120.6736,name:'台中市'}};
function readWeatherPrefs(){try{const p=JSON.parse(localStorage.getItem(WX_PREF)||'{}');return {gps:p.gps===true,city:WX_CITIES[p.city]?p.city:'hsinchu',minutes:[30,60,120].includes(Number(p.minutes))?Number(p.minutes):60}}catch{return {gps:false,city:'hsinchu',minutes:60}}}
let weatherPrefs=readWeatherPrefs(),weatherInfo=null,weatherBusy=false,weatherError='';
// Keep the last successful result across PWA restarts; stale data is shown while refreshing.
try{const saved=JSON.parse(localStorage.getItem('sw-weather-last')||'null');if(saved&&saved.prefKey===`${weatherPrefs.gps?'gps':'city'}:${weatherPrefs.city}`&&Date.now()-saved.fetched<24*3600000)weatherInfo=saved}catch{}
const weatherCodes={0:'晴朗',1:'大致晴朗',2:'局部多雲',3:'陰天',45:'有霧',48:'有霧',51:'毛毛雨',53:'毛毛雨',55:'毛毛雨',61:'小雨',63:'下雨',65:'大雨',80:'陣雨',81:'陣雨',82:'強陣雨',95:'雷雨'};
function weatherMarkup(){if(!weatherInfo)return `<div class="weather-card"><div><strong>今日天氣</strong><p class="muted">${weatherBusy?'正在查詢天氣…':'尚未取得天氣資訊'}</p></div></div>${weatherError?`<p class="notice">${esc(weatherError)}</p>`:''}`;
 const w=weatherInfo;return `<div class="weather-card"><div><span class="muted">${esc(w.place)} · ${esc(w.time)}</span><div class="weather-main"><strong>${Math.round(w.temp)}°C</strong><span>${esc(weatherCodes[w.code]||'天氣資訊')} · 體感 ${Math.round(w.feels)}°C</span></div><p class="muted">今日 ${Math.round(w.low)}–${Math.round(w.high)}°C · 降雨機率最高 ${Math.round(w.rain)}%</p></div></div>${weatherError?`<p class="notice">${esc(weatherError)}</p>`:''}`}
function weatherSettingsHTML(){return `<div class="section-head"><h2>天氣與定位</h2></div><div class="card stack"><label class="weather-toggle-row"><span><strong>使用目前位置</strong><small class="muted">開啟後自動查詢所在地天氣</small></span><input type="checkbox" id="weatherGpsToggle" role="switch" ${weatherPrefs.gps?'checked':''}></label><label>固定天氣地點<select id="weatherCity" ${weatherPrefs.gps?'disabled':''}>${Object.entries(WX_CITIES).map(([key,v])=>`<option value="${key}" ${weatherPrefs.city===key?'selected':''}>${v.name}</option>`).join('')}</select></label><label>自動更新間隔<select id="weatherInterval">${[30,60,120].map(n=>`<option value="${n}" ${weatherPrefs.minutes===n?'selected':''}>每 ${n===60?'1 小時':n===120?'2 小時':n+' 分鐘'}</option>`).join('')}</select></label><p class="notice">開啟 App、返回前景或持續使用時，會在資料過期後自動更新。iPhone 不保證背景持續更新；定位權限由系統管理。定位失敗時使用固定城市。</p></div>`}
function weatherFresh(){return weatherInfo&&weatherInfo.prefKey===`${weatherPrefs.gps?'gps':'city'}:${weatherPrefs.city}`&&Date.now()-weatherInfo.fetched<weatherPrefs.minutes*60000}
async function getWeather(force=false){if(weatherBusy||(!force&&weatherFresh()))return;weatherBusy=true;weatherError='';try{
 let city=WX_CITIES[weatherPrefs.city],lat=city.lat,lon=city.lon,place=city.name;
 if(weatherPrefs.gps){try{const last=JSON.parse(localStorage.getItem('sw-last-location')||'null');if(last&&Date.now()-last.at<24*3600000&&Number.isFinite(last.lat)&&Number.isFinite(last.lon)){lat=last.lat;lon=last.lon;place='目前位置（上次定位）'}else{if(!navigator.geolocation)throw Error('瀏覽器不支援定位');const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:4500,maximumAge:900000,enableHighAccuracy:false}));lat=pos.coords.latitude;lon=pos.coords.longitude;place='目前位置';localStorage.setItem('sw-last-location',JSON.stringify({lat,lon,at:Date.now()}))}}catch(err){place=city.name+'（定位未成功）';weatherError='無法取得目前位置，已改用'+city.name+'天氣。可在 iPhone 設定中檢查定位權限。'}}
 const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
 const controller=new AbortController();const timeoutId=setTimeout(()=>controller.abort(),7000);let response;try{response=await fetch(url,{cache:'no-store',signal:controller.signal})}finally{clearTimeout(timeoutId)}if(!response.ok)throw Error('天氣服務暫時無法使用');const j=await response.json();if(!j.current||!j.daily)throw Error('天氣資料不完整');
 weatherInfo={place,temp:j.current.temperature_2m,feels:j.current.apparent_temperature,code:j.current.weather_code,high:j.daily.temperature_2m_max[0],low:j.daily.temperature_2m_min[0],rain:j.daily.precipitation_probability_max[0]??0,time:j.current.time.replace('T',' '),fetched:Date.now(),prefKey:`${weatherPrefs.gps?'gps':'city'}:${weatherPrefs.city}`};
 sessionStorage.setItem('sw-weather',JSON.stringify(weatherInfo));try{localStorage.setItem('sw-weather-last',JSON.stringify(weatherInfo))}catch{}
 }catch(err){weatherError=weatherInfo?'目前顯示上次天氣資料，暫時無法更新。':'無法更新天氣：'+(err.name==='AbortError'?'連線逾時':err.message)}finally{weatherBusy=false;if(page==='home'){const panel=document.querySelector('#weatherPanel');if(panel)panel.innerHTML=weatherMarkup()}}}
function saveWeatherPrefs(){if(!weatherPrefs.gps)localStorage.removeItem('sw-last-location');localStorage.setItem(WX_PREF,JSON.stringify(weatherPrefs));weatherInfo=null;weatherError='';try{const saved=JSON.parse(localStorage.getItem('sw-weather-last')||'null');if(saved&&saved.prefKey===`${weatherPrefs.gps?'gps':'city'}:${weatherPrefs.city}`&&Date.now()-saved.fetched<24*3600000)weatherInfo=saved}catch{}getWeather(true)}
setInterval(()=>{if(!document.hidden)getWeather()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)getWeather()});
window.addEventListener('focus',()=>getWeather());
function outfitVisual(o){const chosen=o.ids.map(id=>items.find(x=>x.id===id)).filter(Boolean);
 // Outfit board: actual uploaded photos where available, otherwise clearly labelled sketches. Not virtual try-on.
 const order={'上衣':1,'洋裝':1,'外套':2,'褲裝':3,'裙裝':3,'襪子／褲襪':4,'鞋子':5,'帽子':6,'其他配件':7,'飾品':7};chosen.sort((a,b)=>(order[a.category]||9)-(order[b.category]||9));
 return `<div class="outfit-board" aria-label="搭配單品視覺預覽">${chosen.map(x=>`<div class="outfit-piece"><img src="${visual(x)}" alt="${esc(x.name)}"><span>${esc(x.name)}</span>${!x.photo?'<small>示意圖</small>':''}</div>`).join('')}</div>`;
}
function outfitHTML(o){return `<article class="card outfit"><span class="pill">${esc(o.label)}</span>${outfitVisual(o)}<ul>${o.ids.map(id=>`<li>${esc(items.find(x=>x.id===id)?.name||id)}</li>`).join('')}</ul><p class="muted">${esc(o.why)}</p><button class="small-btn" data-record="${esc(o.ids.join(','))}">記錄今天穿這套</button></article>`}
function itemCard(x){return `<article class="card"><div class="item-img ${x.photo?'':'placeholder'}">${`<img class="item-img" src="${visual(x)}" alt="${esc(x.name)}${x.photo?'':'（示意圖）'}">`}</div><h3>${esc(x.name)}</h3><div class="row"><span class="pill">${esc(x.category)}</span>${x.status==='wishlist'?'<span class="pill">考慮購買</span>':''}${!x.photo?'<span class="pill">示意圖</span>':''}</div><p class="muted">${esc(x.color||'未分類')} · ${esc(x.style||'未設定')}</p><div class="row">${x.photo?`<button class="small-btn" data-ai-cutout="${esc(x.id)}">AI 去背（測試版）</button><button class="small-btn secondary" data-cutout="${esc(x.id)}">${x.photoCutout?'調整去背':'去背設定'}</button>${x.photoOriginal?`<button class="small-btn secondary" data-restore="${esc(x.id)}">還原原圖</button>`:''}`:''}<button class="small-btn secondary" data-edit="${esc(x.id)}">編輯</button><button class="small-btn danger" data-delete="${esc(x.id)}">刪除</button></div></article>`}
function render(){document.querySelectorAll('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const app=$('#app');const today=new Date().toLocaleDateString('zh-TW',{year:'numeric',month:'long',day:'numeric',weekday:'long'});const count=owned().length;let html='';
if(page==='home'){html=`<div class="hero"><div class="muted">${esc(today)}</div><h2>今天想穿什麼？</h2><p>從你已擁有的衣物，挑出適合自己的日常穿搭。</p><div id="weatherPanel">${weatherMarkup()}</div><p class="weather-help">天氣會自動更新，可至「設定」調整位置與更新頻率。</p><button data-page="outfits">看看今日推薦</button> <button class="secondary" data-page="studio">自由搭配工作室</button></div><div class="stats"><div class="card stat"><strong>${count}</strong><span class="muted">已擁有</span></div><div class="card stat"><strong>${items.length-count}</strong><span class="muted">購物候選</span></div><div class="card stat"><strong>${outfits().length}</strong><span class="muted">搭配提案</span></div></div><div class="section-head"><h2>今日穿搭靈感</h2></div><p class="muted">使用衣櫃照片排列成搭配預覽；無照片的衣物以示意圖呈現，尚非 AI 真人試穿效果。</p><div class="stack">${outfits().slice(0,1).map(outfitHTML).join('')||'<p class="empty">衣櫃單品不足，請先新增衣物。</p>'}</div>`}
if(page==='closet'){let cats=['全部',...new Set(items.map(x=>x.category))];let shown=items.filter(x=>(filter==='全部'||x.category===filter)&&(showWishlist||x.status==='owned'));html=`<div class="section-head"><h2>我的衣櫃 · ${shown.length} 件</h2><div class="closet-actions"><button class="secondary" data-order-open>匯入訂單</button><button data-add>＋ 新增</button></div></div><div class="row"><label class="wishlist-toggle"><input type="checkbox" id="wishlistToggle" ${showWishlist?'checked':''}><span>顯示購物候選</span></label></div><div class="chips">${cats.map(c=>`<button class="chip ${filter===c?'active':''}" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="grid">${shown.map(itemCard).join('')}</div>${shown.length?'':'<p class="empty">此分類目前沒有單品</p>'}`}
if(page==='outfits'){html=`<div class="section-head"><h2>三種穿搭提案</h2><button data-page="studio">自由搭配工作室</button></div><p class="muted">規則式推薦：只使用已擁有的衣物，並考慮必要配件。</p><label>目前季節<select id="seasonSelect"><option value="warm" ${localStorage.getItem('sw-season')==='warm'?'selected':''}>溫暖季節</option><option value="cool" ${localStorage.getItem('sw-season')!=='warm'?'selected':''}>涼爽季節</option></select></label><div class="stack">${outfits().map(outfitHTML).join('')||'<p class="empty">可用衣物不足，無法產生搭配。</p>'}</div><p class="notice">v0.1 為初步規則，並非 AI 分析；不會判斷照片中的衣服是否真正遮住腋下，請在新增單品時於備註標示。</p>`}
if(page==='studio'){html=studioHTML()}
if(page==='history'){html=`<div class="section-head"><h2>穿搭紀錄</h2></div><div id="historyList" class="stack"><p class="muted">正在讀取紀錄…</p></div>`}
if(page==='settings'){html=`${profileHTML()}<div class="section-head"><h2>應用程式設定</h2></div>${weatherSettingsHTML()}<div class="section-head"><h2>資料管理與備份</h2></div><div class="card stack"><button id="exportBtn">匯出完整 JSON 備份（含照片與個人設定）</button><button class="secondary" id="importBtn">匯入 JSON 備份</button><p class="notice">匯入會覆蓋目前所有衣物及穿搭紀錄，請先匯出備份。資料只儲存在此瀏覽器，清除網站資料可能造成遺失；不同裝置不會自動同步。</p></div>`}

app.innerHTML=html;if(page==='history')renderHistory();if(page==='studio')setupStudioCanvas()}
async function renderHistory(){let rows=(await all('history')).sort((a,b)=>b.date.localeCompare(a.date));const el=$('#historyList');if(!el)return;el.innerHTML=rows.length?rows.map(x=>`<div class="card"><strong>${esc(x.date)}</strong><ul>${x.names.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><button class="small-btn danger" data-delrecord="${esc(x.id)}">刪除紀錄</button></div>`).join(''):'<p class="empty">還沒有穿搭紀錄。從「推薦」頁面選擇一套開始吧！</p>'}
function editor(id){let x=items.find(v=>v.id===id),f=$('#itemForm');f.reset();for(let key of ['id','name','category','color','style','season','status','notes'])if(x&&f.elements[key])f.elements[key].value=x[key]||'';$('#editorTitle').textContent=x?'編輯單品':'新增單品';$('#photoPreview').hidden=!x?.photo;$('#photoPreview').src=x?.photo||'';$('#editor').showModal()}
async function compressPhoto(file){if(!file)return null;if(!file.type.startsWith('image/'))throw Error('請選擇圖片檔');if(file.size>15*1024*1024)throw Error('圖片請小於 15MB');let bitmap=await createImageBitmap(file);let scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));let c=document.createElement('canvas');c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale));c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();return c.toDataURL('image/jpeg',.78)}
$('#itemForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,fd=new FormData(f),id=String(fd.get('id')||uid()),old=items.find(x=>x.id===id);let data={...old,id};for(let k of ['name','category','color','style','season','status','notes'])data[k]=String(fd.get(k)||'').trim();if(!data.name)return;try{let file=$('#photoInput').files[0];if(file){data.photo=await compressPhoto(file);data.photoOriginal=data.photo;data.photoCutout=false;}await put(STORE,data);$('#editor').close();await load()}catch(err){alert('儲存失敗：'+err.message+'。可能是瀏覽器儲存空間不足。')}});
$('#cancelEditor').onclick=()=>$('#editor').close();$('#photoInput').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{$('#photoPreview').src=await compressPhoto(f);$('#photoPreview').hidden=false}catch(err){alert(err.message)}};
$('#app').addEventListener('click',async e=>{let b=e.target.closest('button');if(!b)return;if(b.dataset.page){page=b.dataset.page;render()}if('add'in b.dataset)editor();if('orderOpen'in b.dataset)openOrderImporter();if(b.dataset.edit)editor(b.dataset.edit);if(b.dataset.filter){filter=b.dataset.filter;render()}if(b.dataset.delete&&confirm('確定刪除這件衣物？')){await del(STORE,b.dataset.delete);await load()}if(b.dataset.record){let ids=b.dataset.record.split(',');let date=new Date().toLocaleDateString('sv-SE');await put('history',{id:uid(),date,ids,names:ids.map(id=>items.find(x=>x.id===id)?.name||id)});alert('已記錄今天的穿搭！')}if(b.dataset.delrecord&&confirm('刪除這筆紀錄？')){await del('history',b.dataset.delrecord);renderHistory()}if(b.dataset.aiCutout){await aiCutoutItem(b.dataset.aiCutout)}if(b.dataset.cutout){await cutoutItem(b.dataset.cutout)}if(b.dataset.restore){await restoreItem(b.dataset.restore)}if(b.dataset.studioAdd){studioAdd(b.dataset.studioAdd)}if(b.dataset.studioSelect){studioActive=b.dataset.studioSelect;render()}if(b.dataset.studioRemove){studioRemove(b.dataset.studioRemove)}if(b.id==='studioSave')await saveStudioOutfit();if(b.id==='studioClear'&&confirm('清空目前疊加的衣物？')){studioLayers=[];studioActive=null;saveStudioDraft();render()}if(b.id==='studioAvatarClear'&&confirm('移除本機全身照片？')){studioAvatar=null;await del('studio','avatar');render()}if(b.id==='profileEditBtn'){profileEditing=!profileEditing;render()}if(b.id==='profileAdjustPhoto'){if(profile.photo)openPortraitEditor(profile.photoOriginal||profile.photo);else $('#portraitFileInput').click()}if(b.id==='exportBtn')await exportData();if(b.id==='importBtn')$('#importFile').click()});
$('#app').addEventListener('change',e=>{if(e.target.dataset.otherToggle){const input=$('#profileForm')?.querySelector(`[data-other-input="${e.target.dataset.otherToggle}"]`);if(input){input.disabled=!e.target.checked;if(e.target.checked)input.focus()}return}if(e.target.id==='profilePhotoInput'){profilePhotoFile(e.target.files[0]);return}if(e.target.id==='wishlistToggle'){showWishlist=e.target.checked;render()}if(e.target.id==='studioCategory'){studioCategory=e.target.value;render()}if(e.target.id==='studioAvatarFile'){setStudioAvatar(e.target.files[0])}if(e.target.id==='seasonSelect'){localStorage.setItem('sw-season',e.target.value);render()}if(e.target.id==='weatherGpsToggle'){weatherPrefs.gps=e.target.checked;saveWeatherPrefs();render()}if(e.target.id==='weatherCity'){weatherPrefs.city=e.target.value;saveWeatherPrefs()}if(e.target.id==='weatherInterval'){weatherPrefs.minutes=Number(e.target.value);saveWeatherPrefs()}});document.querySelector('.bottom').addEventListener('click',e=>{let b=e.target.closest('[data-page]');if(b){page=b.dataset.page;render()}});
async function exportData(){let data={format:'smart-wardrobe-v0.1',exportedAt:new Date().toISOString(),items:await all(STORE),history:await all('history'),studio:await all('studio')};let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='smart-wardrobe-backup-'+new Date().toLocaleDateString('sv-SE')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
$('#app').addEventListener('submit',async e=>{if(e.target.id!=='profileForm')return;e.preventDefault();const form=e.target,next=readProfileForm(form);for(const k of ['height','weight','waist']){if(next[k]&&(!Number.isFinite(Number(next[k]))||Number(next[k])<=0)){alert('請輸入正確的身高、體重與腰圍');return}}for(const k of ['styles','restrictions','preferences']){if(next[k].some(x=>x.length>60)){alert('自訂選項請勿超過 60 字');return}}try{profile=next;await saveProfile();profileEditing=false;render()}catch(err){alert('儲存失敗：'+err.message)}});
$('#importFile').addEventListener('change',async e=>{let file=e.target.files[0];if(!file)return;try{let data=JSON.parse(await file.text());if(data.format!=='smart-wardrobe-v0.1'||!Array.isArray(data.items)||!Array.isArray(data.history)||data.items.some(x=>!x||typeof x.id!=='string'||typeof x.name!=='string')||data.history.some(x=>!x||typeof x.id!=='string'))throw Error('備份格式不正確');if(!confirm('匯入將覆蓋現有衣櫃與紀錄，確定繼續？'))return;await new Promise((res,rej)=>{let t=db.transaction([STORE,'history'],'readwrite');t.objectStore(STORE).clear();t.objectStore('history').clear();data.items.forEach(x=>t.objectStore(STORE).put(x));data.history.forEach(x=>t.objectStore('history').put(x));t.oncomplete=res;t.onerror=()=>rej(t.error)});if(Array.isArray(data.studio)){await new Promise((res,rej)=>{const t=db.transaction('studio','readwrite'),st=t.objectStore('studio');st.clear();data.studio.forEach(x=>{if(x&&typeof x.id==='string')st.put(x)});t.oncomplete=res;t.onerror=()=>rej(t.error)});studioAvatar=(await all('studio')).find(x=>x.id==='avatar')?.photo||null;profile=readProfile((await all('studio')).find(x=>x.id==='profile'));}await load();alert('匯入完成')}catch(err){alert('匯入失敗：'+err.message)}finally{e.target.value=''}});
(async()=>{try{db=await openDB();let seeded=localStorage.getItem('sw-seeded');if(!seeded){if(!(await all(STORE)).length){for(let x of starter)await put(STORE,x)}localStorage.setItem('sw-seeded','1')}const studioRecords=await all('studio');studioAvatar=studioRecords.find(x=>x.id==='avatar')?.photo||null;profile=readProfile(studioRecords.find(x=>x.id==='profile'));try{studioLayers=JSON.parse(localStorage.getItem('sw-studio-layers')||'[]')}catch{studioLayers=[]}try{const old=JSON.parse(sessionStorage.getItem('sw-weather')||'null');if(old&&Date.now()-old.fetched<24*3600000&&old.prefKey===`${weatherPrefs.gps?'gps':'city'}:${weatherPrefs.city}`)weatherInfo=old}catch{}await load();getWeather();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}catch(err){$('#app').innerHTML='<div class="card">無法啟動本機資料庫。請使用一般瀏覽模式，並確認瀏覽器允許網站儲存資料。</div>';console.error(err)}})();


// v0.2.1: 本機真人照片 + 可移動、縮放的衣物照片圖層。
function saveStudioDraft(){localStorage.setItem('sw-studio-layers',JSON.stringify(studioLayers))}
function studioHTML(){
 const choices=owned().filter(x=>x.category===studioCategory);
 const current=studioLayers.find(x=>x.key===studioActive);
 return `<div class="section-head"><h2>我的穿搭工作室</h2><span class="pill">v0.2.2</span></div>
 <p class="muted">以你的全身照作為底圖，手動移動衣物圖層。沒有照片的單品會顯示分類示意圖，並非實際試穿。</p>
 <div class="studio-layout"><section class="card"><div class="section-head"><h2>我的全身照</h2></div>
 <label class="studio-upload">上傳／更換照片<input type="file" id="studioAvatarFile" accept="image/*"></label>
 <div id="studioStage" class="studio-stage">${studioAvatar?`<img class="studio-avatar" src="${studioAvatar}" alt="我的全身照片" draggable="false">`:'<div class="studio-empty">請先上傳正面全身照<br><small>照片只保存在這個瀏覽器</small></div>'}
 ${studioLayers.map((l,i)=>{let it=items.find(x=>x.id===l.id);return it?`<img class="studio-layer ${studioActive===l.key?'selected':''}" data-layer="${esc(l.key)}" src="${visual(it)}" alt="${esc(it.name)}" draggable="false" style="left:${l.x}%;top:${l.y}%;width:${l.w}%;z-index:${i+2}">`:''}).join('')}</div>
 <p class="notice">點選衣物圖層後拖曳移動；下方滑桿調整大小。無照片單品以示意圖顯示；純色去背可在衣櫃單品卡片操作。</p>
 ${current?`<div class="studio-controls"><strong>正在調整：${esc(items.find(x=>x.id===current.id)?.name||'衣物')}</strong><label>圖片寬度 <input id="studioSize" type="range" min="12" max="115" value="${current.w}"></label><button class="secondary small-btn" data-studio-remove="${esc(current.key)}">移除此圖層</button></div>`:''}
 <div class="row"><button id="studioSave">儲存這套穿搭</button><button class="secondary" id="studioClear">清空衣物</button><button class="secondary" id="studioAvatarClear">移除照片</button></div></section>
 <section class="card"><h2>點選衣櫃搭配</h2><label>衣物分類<select id="studioCategory">${studioCategories.map(c=>`<option ${c===studioCategory?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
 <div class="studio-items">${choices.map(x=>`<button class="studio-item" data-studio-add="${esc(x.id)}"><span><img src="${visual(x)}" alt=""></span><small>${esc(x.name)}</small></button>`).join('')||'<p class="muted">此分類尚無已擁有衣物。</p>'}</div>
 <p class="notice">只顯示「已擁有」單品；考慮購買的衣服不會混入。</p>
 <h3>目前搭配（可單件移除）</h3><div class="stack">${studioLayers.map(l=>`<div class="studio-selected-row"><button class="secondary" data-studio-select="${esc(l.key)}">${esc(items.find(x=>x.id===l.id)?.name||'已移除的衣物')} · 調整</button><button class="danger small-btn" data-studio-remove="${esc(l.key)}" aria-label="移除此件衣物">✕ 移除</button></div>`).join('')||'<p class="muted">還沒有選擇衣物。</p>'}</div>
 ${studioLayers.some(l=>l.id==='SW-P003')&&!studioLayers.some(l=>l.id==='SW-A001')?'<p class="notice">提醒：灰黑寬版牛仔褲需要搭配米白色編織皮帶。</p>':''}
 <p class="notice">提醒：無袖、掛脖或大挖袖單品，請自行搭配能遮住腋下的內搭或外套。此版本無法從照片自動判斷遮蔽效果。</p></section></div>`
}
function studioRemove(key){studioLayers=studioLayers.filter(x=>x.key!==key);studioActive=studioLayers.at(-1)?.key||null;saveStudioDraft();render()}
function studioAdd(id){const it=items.find(x=>x.id===id&&x.status==='owned');if(!it)return;const key=uid();studioLayers.push({key,id,x:30,y:25,w:42});studioActive=key;saveStudioDraft();render()}
async function setStudioAvatar(file){if(!file)return;try{const photo=await compressPhoto(file);await put('studio',{id:'avatar',photo});studioAvatar=photo;render()}catch(err){alert('照片儲存失敗：'+err.message)}}
function setupStudioCanvas(){const stage=$('#studioStage');if(!stage)return;const slider=$('#studioSize');if(slider)slider.oninput=e=>{let l=studioLayers.find(x=>x.key===studioActive);if(l){l.w=Number(e.target.value);saveStudioDraft();const el=Array.from(stage.querySelectorAll('[data-layer]')).find(n=>n.dataset.layer===l.key);if(el)el.style.width=l.w+'%'}};
 let dragging=null;stage.addEventListener('pointerdown',e=>{const el=e.target.closest('[data-layer]');if(!el)return;const l=studioLayers.find(x=>x.key===el.dataset.layer);if(!l)return;studioActive=l.key;dragging={key:l.key,px:e.clientX,py:e.clientY,x:l.x,y:l.y};el.classList.add('selected');stage.querySelectorAll('[data-layer]').forEach(n=>{if(n!==el)n.classList.remove('selected')});stage.setPointerCapture(e.pointerId);const c=$('.studio-controls');if(c){c.querySelector('strong').textContent='正在調整：'+(items.find(x=>x.id===l.id)?.name||'衣物');c.querySelector('#studioSize').value=l.w;c.querySelector('[data-studio-remove]').dataset.studioRemove=l.key}else{dragging=null;render()}});
 stage.addEventListener('pointermove',e=>{if(!dragging)return;const l=studioLayers.find(x=>x.key===dragging.key);if(!l)return;const r=stage.getBoundingClientRect();l.x=Math.max(-40,Math.min(100,dragging.x+(e.clientX-dragging.px)/r.width*100));l.y=Math.max(-40,Math.min(100,dragging.y+(e.clientY-dragging.py)/r.height*100));const el=Array.from(stage.querySelectorAll('[data-layer]')).find(n=>n.dataset.layer===l.key);if(el){el.style.left=l.x+'%';el.style.top=l.y+'%'}});
 const stop=()=>{if(dragging){dragging=null;saveStudioDraft()}};stage.addEventListener('pointerup',stop);stage.addEventListener('pointercancel',stop)
}
async function saveStudioOutfit(){const ids=[...new Set(studioLayers.map(x=>x.id).filter(id=>items.some(x=>x.id===id&&x.status==='owned')))];if(!ids.length){alert('請先選擇衣物。');return}const date=new Date().toLocaleDateString('sv-SE');try{await put('history',{id:uid(),date,ids,names:ids.map(id=>items.find(x=>x.id===id)?.name||id),source:'studio'});alert('已將這套穿搭儲存至穿搭紀錄！')}catch(err){alert('儲存失敗：'+err.message)}}

async function cutoutItem(id){
 const x=items.find(v=>v.id===id);if(!x?.photo)return;
 const toleranceRaw=prompt('去背容差（0–100）：數值越高，移除背景越多；建議先試 30。若衣服也被去除，請調低數值。',String(x.cutoutTolerance??30));
 if(toleranceRaw===null)return;const tolerance=Number(toleranceRaw);if(!Number.isFinite(tolerance)||tolerance<0||tolerance>100){alert('請輸入 0 到 100 的數值。');return}
 const featherRaw=prompt('邊緣柔化（0–40）：建議 12；數值越高，邊緣越柔和。',String(x.cutoutFeather??12));
 if(featherRaw===null)return;const feather=Number(featherRaw);if(!Number.isFinite(feather)||feather<0||feather>40){alert('請輸入 0 到 40 的數值。');return}
 try{const original=x.photoOriginal||x.photo;const photo=await removePlainBackground(original,tolerance,feather);await put(STORE,{...x,photo,photoOriginal:original,photoCutout:true,cutoutTolerance:tolerance,cutoutFeather:feather});await load();alert('去背已套用。請檢查衣服邊緣；如果有缺損，可點「調整去背」降低容差，或還原原圖。')}catch(e){alert('去背失敗：'+e.message)}
}
async function restoreItem(id){const x=items.find(v=>v.id===id);if(!x?.photoOriginal)return;await put(STORE,{...x,photo:x.photoOriginal,photoCutout:false});await load()}

// v0.2.4: Experimental client-side semantic background removal. No photos are
// uploaded to our own server. The first use downloads third-party model files.
// The preview is never committed until the user explicitly confirms.
async function aiCutoutItem(id){
 const item=items.find(x=>x.id===id);if(!item?.photo)return;
 const original=item.photoOriginal||item.photo;
 const dlg=document.createElement('dialog');dlg.className='ai-preview-dialog';
 dlg.innerHTML=`<div class="ai-preview-inner"><h2>AI 智慧去背（測試版）</h2><p class="muted">首次執行需下載模型，可能花費一些時間。照片在此瀏覽器處理；模型檔案由第三方提供。複雜背景或多件衣服重疊時仍可能失敗。</p><p id="aiStatus" role="status">正在準備模型…</p><div class="ai-compare"><figure><img src="${original}" alt="原始照片"><figcaption>原始照片</figcaption></figure><figure><div class="ai-checker"><img id="aiResult" alt="AI 去背預覽" hidden></div><figcaption>去背預覽</figcaption></figure></div><div class="actions"><button type="button" id="aiCancel" class="secondary">取消</button><button type="button" id="aiApply" disabled>確認套用</button></div></div>`;
 document.body.append(dlg);dlg.showModal();
 let alive=true,result=null;
 const cancel=()=>{alive=false;dlg.close();dlg.remove()};
 dlg.querySelector('#aiCancel').onclick=cancel;
 dlg.addEventListener('cancel',e=>{e.preventDefault();cancel()});
 dlg.querySelector('#aiApply').onclick=async()=>{
  if(!result||!alive)return;
  try{await put(STORE,{...item,photo:result,photoOriginal:original,photoCutout:true,cutoutMethod:'ai'});cancel();await load()}
  catch(err){dlg.querySelector('#aiStatus').textContent='儲存失敗：'+err.message}
 };
 try{
  // Lazy-load only on demand to keep the wardrobe lightweight.
  const module=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
  if(!alive)return;
  const removeBackground=module.removeBackground||module.default;
  if(typeof removeBackground!=='function')throw Error('模型程式載入不完整');
  dlg.querySelector('#aiStatus').textContent='正在辨識衣物，請保持此頁開啟…';
  const blob=await removeBackground(original,{progress:(key,current,total)=>{
   if(alive&&total>0)dlg.querySelector('#aiStatus').textContent=`模型載入中：${Math.round(current/total*100)}%`;
  }});
  if(!alive)return;
  if(!(blob instanceof Blob))throw Error('AI 模型未產生有效圖片');
  result=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('圖片轉換失敗'));reader.readAsDataURL(blob)});
  if(!alive)return;
  dlg.querySelector('#aiResult').src=result;dlg.querySelector('#aiResult').hidden=false;
  dlg.querySelector('#aiApply').disabled=false;
  dlg.querySelector('#aiStatus').textContent='完成。請確認主要衣物與邊緣是否完整，再決定是否套用。';
 }catch(err){if(alive)dlg.querySelector('#aiStatus').textContent='AI 去背無法完成：'+err.message+'。可取消並使用原本的去背設定，或換素色背景拍攝。'}
}


// v0.3.4 訂單截圖匯入：OCR 只在使用者操作時下載至瀏覽器執行；不連接購物帳號。
const orderBrands=['UNIQLO','GU','其他'];
function orderCategory(name){if(/購物袋|Shopping Bag|洗沐|洗髮|贈品|試用品/.test(name))return '排除';if(/內褲|內衣|胸罩|BRA|AIRism.*內褲/.test(name))return '排除';if(/襪|褲襪/.test(name))return '襪子／褲襪';if(/腰帶|皮帶/.test(name))return '其他配件';if(/外套|夾克|大衣|罩衫/.test(name))return '外套';if(/連身裙|洋裝/.test(name))return '洋裝';if(/裙/.test(name))return '裙裝';if(/褲|牛仔/.test(name))return '褲裝';if(/鞋/.test(name))return '鞋子';if(/帽/.test(name))return '帽子';return '上衣'}
function normalizeOrderText(text){return String(text||'').replace(/\r/g,'').replace(/[：﹕]/g,':').replace(/[（]/g,'(').replace(/[）]/g,')').replace(/\u00a0/g,' ')}
function orderClean(line){return line.replace(/(?<=[\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu,'').replace(/\s+/g,' ').trim()}
function orderNameCandidate(line){
 let t=orderClean(line).replace(/^[^\p{Script=Han}A-Za-z]+/u,'').replace(/^(?:女裝|男裝|童裝)\s*/,'').trim();
 t=t.replace(/(?:\s*(?:MN|UL|CL\+E)\s*)?\b\d{6}\b.*$/i,'').replace(/\s*[\[【][^\]】]*$/,'').replace(/\s+(?:UL|CL\+E|MN)$/i,'').trim();
 if(/^(?:商品|訂單|顏色|尺寸|購物|總金額|新竹|台南|新光|遠東|南紡|訂單編號|商品詳情|贈品|NT\$|NTS|時間|商品圖片)/.test(t))return '';
 const hasGarment=/(?:上衣|外套|連帽|拉鍊|腰帶|皮帶|襪|牛仔|襯衫|連身裙|洋裝|短裙|長裙|褲|T恤|針織|內褲|內衣|背心|帽|鞋|罩衫|大衣|夾克|毛衣|開襟|AIRism|Fine gauge|Shopping Bag|洗沐組|洗髮)/i.test(t);
 if(!hasGarment||t.length<3||t.length>90)return '';
 return t.replace(/[\s|=—]+$/,'').trim();
}
function parseOrderText(text,brand='GU'){
 const lines=normalizeOrderText(text).split('\n').map(orderClean).filter(Boolean),found=[];
 let current=null,orderId='',date='';
 const commit=()=>{if(current&&current.name){current.category=orderCategory(current.name);current.include=current.category!=='排除';found.push(current)}current=null};
 const setSku=(x,str)=>{let m=str.match(/\b(\d{6})\b/);if(m)x.sku=m[1]};
 const setColorSize=(x,str)=>{let t=str.replace(/^.*?(?:顏色|色)\s*:/,'').replace(/^[\s\/=\-]+/,'').trim();let size=t.match(/\b(ONE\s*SIZE|XXS|XXL|XS|XL|S|M|L)\b/i);if(size){x.size=size[1].toUpperCase().replace(/\s+/g,' ');t=t.replace(size[0],'').trim()}let color=t.match(/(?:\b\d{2}\s*)?\b(NATURAL|NAVY|BLUE|BLACK|WHITE|DARK\s*GRAY|GRAY|GREY|BEIGE|PINK|GREEN|BROWN|OTHER|RED|YELLOW|OLIVE|PURPLE)\b/i);if(color)x.color=color[0].trim().toUpperCase()};
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(/^商品詳情$/.test(line)){commit();orderId='';date='';continue}let m=line.match(/訂單\s*編號\s*:?\s*(\d{7,15})/);if(m){commit();orderId=m[1];date='';continue}
  m=line.match(/(20\d\d)[-/.](\d\d)[-/.](\d\d)/);if(m){date=`${m[1]}-${m[2]}-${m[3]}`;if(current)current.date=date}
  const name=orderNameCandidate(line);
  if(name){commit();current={name,brand,orderId,date,color:'',size:'',sku:'',price:null,quantity:1,category:'上衣',photo:null,include:true};setSku(current,line);continue}
  if(!current)continue;
  if(/(?:訂單總金額|訂單\s*總\s*金額)/.test(line)){commit();continue}
  if(/(?:^|\s)顏色\s*:/.test(line)){setColorSize(current,line);continue}
  if(/(?:^|\s)尺寸\s*:/.test(line)){let v=line.split(':').slice(1).join(':').match(/\b(ONE\s*SIZE|XXS|XXL|XS|XL|S|M|L)\b/i);if(v)current.size=v[1].toUpperCase();continue}
  if(/^NT\s*\$\s*[\d,]+/i.test(line)){current.price=Number(line.replace(/[^\d]/g,''))||null;continue}
  if(/^[xX×]\s*\d+/.test(line)){current.quantity=Number(line.match(/\d+/)?.[0]||1);continue}
  if(/\b\d{6}\b/.test(line)){setSku(current,line);setColorSize(current,line);continue}
  if(/\b(?:NATURAL|NAVY|BLUE|BLACK|WHITE|GRAY|GREY|BEIGE|PINK|GREEN|BROWN|OTHER)\b/i.test(line)){setColorSize(current,line);continue}
  if(!current.sku&&/^(?:MN|UL|CL\+E)?\s*\d{6}$/.test(line))setSku(current,line);
 }
 commit();return found;
}
const SMART_WARDROBE_WORKER="https://smart-wardrobe-ai.lily0828x98.workers.dev";
// v0.3.6.4: Parse official app share messages locally; never send share text to AI.
function parseProductShareText(raw){
 const text=String(raw||'').trim();
 const urlMatch=text.match(/https:\/\/[^\s<>「」【】]+/i);
 if(!urlMatch)return {error:'分享文字中找不到 HTTPS 商品網址。請確認複製的是完整分享內容。'};
 let url;try{url=new URL(urlMatch[0].replace(/[，。；、）)]+$/g,''))}catch{return {error:'分享文字中的網址格式不正確'}}
 const host=url.hostname.toLowerCase();
 const brand=host==='gu-global.com'||host.endsWith('.gu-global.com')?'GU':host==='uniqlo.com'||host.endsWith('.uniqlo.com')?'UNIQLO':'';
 if(!brand||url.protocol!=='https:')return {error:'目前只支援 GU／UNIQLO 官方 HTTPS 商品連結'};
 const bracket=text.match(/【([^】]{2,180})】/);
 let title=(bracket?.[1]||text.slice(0,text.indexOf(urlMatch[0]))).replace(/^快來看看\s*/,'').replace(/[。！!，,\s]+$/,'').trim();
 const sku=title.match(/\b(\d{6})\b/)?.[1]||text.match(/(?:商品編號|貨號)\s*[:：]?\s*(\d{6})/)?.[1]||'';
 title=title.replace(/\s*\b\d{6}\b\s*$/,'').trim();
 if(!title||title.length>110)return {error:'找不到明確的商品名稱，請使用手動新增'};
 const name=title.replace(/^(女裝|男裝|童裝)\s*/,'').trim();
 const item={name,brand,orderId:'',date:'',color:'',size:'',sku,price:null,quantity:1,category:orderCategory(name),photo:null,include:true,officialUrl:url.toString(),photoStatus:'已取得 App 分享的官方商品網址，請點「讀取官方商品照片」；顏色及尺寸請自行確認。'};
 item.include=item.category!=='排除';
 return {item};
}
// Parse multiple app-share messages. Each supported URL ends one product message.
function parseProductShareBatch(raw){
 const text=String(raw||'').trim();
 const matches=[...text.matchAll(/https:\/\/[^\s<>「」【】]+/gi)];
 if(!matches.length)return {items:[],errors:['沒有找到官方商品網址，請貼上完整的 App 分享文字。']};
 const items=[],errors=[];
 let start=0;
 for(const m of matches){
  const end=m.index+m[0].length;
  const segment=text.slice(start,end).trim();
  const result=parseProductShareText(segment);
  if(result.item)items.push(result.item);
  else errors.push('第 '+(items.length+errors.length+1)+' 項：'+result.error);
  start=end;
 }
 return {items,errors};
}
function orderKey(x){return [x.brand||'',x.orderId||'',x.sku||'',x.name.trim().toLowerCase(),x.color.trim().toLowerCase(),x.size.trim().toLowerCase()].join('|')}
function orderMerge(incoming){for(const x of incoming){let old=orderDraft.find(y=>orderKey(y)===orderKey(x));if(old){old.quantity=Math.max(old.quantity,x.quantity||1);continue}orderDraft.push(x)}renderOrderDraft()}
function openOrderImporter(){orderDraft=[];orderOCRStatus='';const dlg=$('#orderDialog');dlg.showModal();$('#geminiStatus').textContent='';$('#productShareStatus').textContent='';$('#productShareText').value='';renderOrderDraft()}
function officialSearchUrl(x){
 const brand=x.brand==='GU'?'GU':x.brand==='UNIQLO'?'UNIQLO':'';
 const q=[brand,x.sku,x.color,x.name].filter(Boolean).join(' ');
 const domain=brand==='GU'?'gu-global.com/tw':brand==='UNIQLO'?'uniqlo.com/tw':'';
 return 'https://www.google.com/search?tbm=isch&q='+encodeURIComponent((domain?'site:'+domain+' ':'')+q);
}
async function officialPhotoLookup(x,providedUrl=''){
 const base=SMART_WARDROBE_WORKER;
 if(!/^https:\/\/[a-z0-9.-]+/i.test(base))throw Error('請先設定 Worker 網址');
 const r=await fetch(base+'/official-photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brand:x.brand,sku:x.sku,color:x.color,name:x.name,productUrl:providedUrl})});
 const data=await r.json().catch(()=>({error:'搜尋服務回傳格式錯誤'}));
 if(!r.ok)throw Error(data.error||'搜尋失敗');return data;
}
function renderOrderDraft(){const area=$('#orderResults');if(!area)return;$('#orderOCRStatus').textContent=orderOCRStatus;area.innerHTML=orderDraft.map((x,i)=>`<div class="order-entry" data-order-index="${i}"><div class="order-entry-head"><label><input type="checkbox" data-order-field="include" ${x.include?'checked':''}> 匯入這件</label><span class="muted">${esc(x.orderId?'訂單末四碼 '+x.orderId.slice(-4):'訂單編號未辨識')}</span></div><label>名稱<input data-order-field="name" value="${esc(x.name)}"></label><div class="order-two"><label>品牌<select data-order-field="brand">${orderBrands.map(b=>`<option ${b===x.brand?'selected':''}>${b}</option>`).join('')}</select></label><label>分類<select data-order-field="category">${[...studioCategories,'排除'].map(c=>`<option ${c===x.category?'selected':''}>${c}</option>`).join('')}</select></label></div><div class="order-two"><label>商品編號<input data-order-field="sku" value="${esc(x.sku)}"></label><label>顏色<input data-order-field="color" value="${esc(x.color)}"></label></div><div class="order-two"><label>尺寸<input data-order-field="size" value="${esc(x.size)}"></label><label>單價 NT$<input type="number" min="0" data-order-field="price" value="${x.price??''}" placeholder="未提供"></label></div><div class="official-photo-panel"><div class="order-photo-row">${x.photo?`<img class="order-thumb" src="${x.photo}" alt="商品照片">`:`<div class="order-photo-empty">尚無商品照片</div>`}<div class="order-photo-actions"><button type="button" class="small-btn secondary" data-official-search="${i}">搜尋官方照片</button><a href="${esc(officialSearchUrl(x))}" target="_blank" rel="noopener noreferrer" class="official-link">開啟官方搜尋</a><small class="muted">${esc(x.photoSource==='official'?'已從官方頁面選取照片，請確認顏色與款式':x.photo?'已手動上傳照片':'不會使用訂單截圖當商品照')}</small></div></div>${x.officialUrl?`<p class="muted">✓ 已透過 App 分享文字取得官方商品網址</p>`:""}${x.officialUrl?`<button type="button" class="small-btn secondary" data-official-verify="${i}">依分享網址讀取照片</button>`:""}<p class="muted official-status">${esc(x.photoStatus||'')}</p><label>或自行上傳商品照片<input type="file" accept="image/*" data-order-photo></label></div><button type="button" class="secondary small-btn" data-order-remove="${i}">移除此項</button></div>`).join('')||'<p class="muted">尚無辨識結果。可上傳截圖進行辨識，或貼上訂單文字後分析。</p>';$('#orderSaveBtn').textContent=`確認加入衣櫃（${orderDraft.filter(x=>x.include&&x.category!=='排除').length} 件）`}
function orderScript(){return new Promise((res,rej)=>{if(window.Tesseract)return res();let script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.onload=res;script.onerror=()=>rej(Error('無法下載 OCR 程式，請檢查網路連線'));document.head.appendChild(script)})}
async function orderOCR(files){if(orderOCRBusy)return;orderOCRBusy=true;$('#orderOCRBtn').disabled=true;try{await orderScript();orderOCRStatus='載入繁體中文辨識模型中，首次使用可能需要一些時間…';renderOrderDraft();const worker=await Tesseract.createWorker('chi_tra+eng',1,{logger:m=>{if(m.status){orderOCRStatus=`辨識中：${m.status} ${m.progress?Math.round(m.progress*100)+'%':''}`;$('#orderOCRStatus').textContent=orderOCRStatus}}});try{for(let i=0;i<files.length;i++){orderOCRStatus=`正在辨識第 ${i+1} / ${files.length} 張截圖…`;renderOrderDraft();let result=await worker.recognize(files[i]);let raw=result.data.text;$('#orderText').value+=($('#orderText').value?'\n':'')+raw;orderMerge(parseOrderText(raw,$('#orderBrand').value))}}finally{await worker.terminate()}orderOCRStatus='辨識完成。請逐項確認資料，漏辨識時可直接修改文字或手動新增。'}catch(err){orderOCRStatus='辨識未完成：'+err.message+'。可改用「貼上文字分析」或手動新增。'}finally{orderOCRBusy=false;$('#orderOCRBtn').disabled=false;renderOrderDraft()}}
$('#orderOCRBtn').addEventListener('click',()=>{let f=$('#orderImages').files;if(!f.length)return alert('請先選擇訂單截圖');orderOCR([...f])});
$('#orderParseBtn').addEventListener('click',()=>{let text=$('#orderText').value.trim();if(!text)return alert('請先貼上訂單文字');let parsed=parseOrderText(text,$('#orderBrand').value);if(!parsed.length)return alert('未辨識到商品名稱。請確認文字內容，或使用手動新增。');orderMerge(parsed)});
$('#productShareImportBtn').addEventListener('click',()=>{
 const result=parseProductShareBatch($('#productShareText').value);
 const status=$('#productShareStatus');
 let matched=0,added=0;const unmatched=[];
 for(const item of result.items){
  const existing=orderDraft.find(x=>x.brand===item.brand&&item.sku&&x.sku===item.sku);
  if(existing){
   existing.officialUrl=item.officialUrl;
   existing.photoStatus='已配對 App 分享文字與官方網址。可點「依分享網址讀取照片」；請核對顏色與尺寸。';
   matched++;
  }else{
   // Preserve separate products when a SKU is absent; do not overwrite unrelated items.
   orderDraft.push(item);added++;unmatched.push(item.name);
  }
 }
 renderOrderDraft();
 status.textContent=`解析 ${result.items.length} 項：配對 ${matched} 項、新增 ${added} 項。`+(result.errors.length?' 未成功：'+result.errors.join('；'):'')+(unmatched.length?' 新增商品請確認顏色及尺寸。':'');
});
$('#orderAddBtn').addEventListener('click',()=>{orderDraft.push({name:'',brand:$('#orderBrand').value,orderId:'',date:'',color:'',size:'',sku:'',price:null,quantity:1,category:'上衣',photo:null,include:true});renderOrderDraft()});
$('#orderResults').addEventListener('input',e=>{let parent=e.target.closest('[data-order-index]');if(!parent)return;let x=orderDraft[Number(parent.dataset.orderIndex)],field=e.target.dataset.orderField;if(!field)return;x[field]=field==='include'?e.target.checked:field==='price'?(e.target.value===''?null:Number(e.target.value)):e.target.value;$('#orderSaveBtn').textContent=`確認加入衣櫃（${orderDraft.filter(x=>x.include&&x.category!=='排除').length} 件）`});
$('#orderResults').addEventListener('change',async e=>{let parent=e.target.closest('[data-order-index]');if(!parent)return;let x=orderDraft[Number(parent.dataset.orderIndex)];if(e.target.matches('[data-order-photo]')){let file=e.target.files[0];if(file){x.photo=await compressPhoto(file);x.photoSource='manual';x.photoStatus='已選擇自行上傳的照片';renderOrderDraft()}}else if(e.target.dataset.orderField){let field=e.target.dataset.orderField;x[field]=field==='include'?e.target.checked:e.target.value;$('#orderSaveBtn').textContent=`確認加入衣櫃（${orderDraft.filter(x=>x.include&&x.category!=='排除').length} 件）`}});
$('#orderResults').addEventListener('click',async e=>{
 const search=e.target.closest('[data-official-search]'),verify=e.target.closest('[data-official-verify]');
 if(!search&&!verify)return;
 const i=Number((search||verify).dataset[search?'officialSearch':'officialVerify']),x=orderDraft[i];if(!x)return;
 const btn=search||verify;btn.disabled=true;x.photoStatus='正在查詢官方商品頁…';renderOrderDraft();
 try{
  const data=await officialPhotoLookup(x,verify?(x.officialUrl||''):'');
  if(data.imageUrl&&data.productUrl){
   x.officialUrl=data.productUrl;x.photoStatus='找到官方候選照片；正在讀取圖片…';renderOrderDraft();
   // Official image URLs are shown directly: storefront CDNs may block CORS downloads.
   // The user confirms the photo before saving; the URL is stored in IndexedDB.
   x.photo=data.imageUrl;x.photoSource='official';x.photoStatus='已取得官方候選照片（外部圖片連結），請人工核對款式及顏色；若需離線使用請自行下載後上傳';
  }else{x.photoStatus=data.message||'未找到可確認的官方照片，請開啟官方搜尋並貼上商品頁網址';}
 }catch(err){x.photoStatus='搜尋未完成：'+err.message+'。可開啟官方搜尋或自行上傳。'}
 renderOrderDraft();
});
$('#orderResults').addEventListener('click',e=>{let b=e.target.closest('[data-order-remove]');if(!b)return;orderDraft.splice(Number(b.dataset.orderRemove),1);renderOrderDraft()});
$('#orderSaveBtn').addEventListener('click',async()=>{const selected=orderDraft.filter(x=>x.include&&x.category!=='排除'&&x.name.trim());if(!selected.length)return alert('請先選擇至少一件衣物');let added=0,duplicate=0;try{for(const x of selected){const key=orderKey(x);if(items.some(it=>it.importKey===key)){duplicate++;continue}const item={id:uid(),name:x.name.trim(),category:x.category,color:x.color,style:'',season:'all',status:'owned',notes:[x.brand,x.sku?'商品編號 '+x.sku:'',x.size?'尺寸 '+x.size:'',x.price!=null?'購入價 NT$'+x.price:'',x.date?'購入日期 '+x.date:''].filter(Boolean).join(' · '),brand:x.brand,sku:x.sku,size:x.size,price:x.price,orderDate:x.date,importKey:key};if(x.officialUrl)item.officialUrl=x.officialUrl;if(x.photo){item.photo=x.photo;item.photoOriginal=x.photo;item.photoCutout=false;item.photoSource=x.photoSource||'manual'}await put(STORE,item);items.push(item);added++}$('#orderDialog').close();await load();alert(`匯入完成：新增 ${added} 件，略過重複 ${duplicate} 件。`)}catch(err){await load();alert('部分匯入失敗：'+err.message)}});


// v0.3.5.1: Gemini vision via private Cloudflare Worker; never place API key in the frontend.
function geminiNormalize(x,brand){
 const name=String(x.name||'').trim().slice(0,100),category=studioCategories.includes(x.category)?x.category:orderCategory(name);
 return {name,brand:orderBrands.includes(x.brand)?x.brand:brand,orderId:String(x.orderId||'').replace(/\D/g,'').slice(0,20),date:String(x.date||'').slice(0,10),color:String(x.color||'').slice(0,60),size:String(x.size||'').slice(0,30),sku:String(x.sku||'').replace(/[^\dA-Za-z-]/g,'').slice(0,30),price:Number.isFinite(Number(x.price))&&x.price!==null&&x.price!==''?Number(x.price):null,quantity:Math.min(10,Math.max(1,Number(x.quantity)||1)),category,photo:null,include:true,confidence:Number(x.confidence)||0,exclude:!!x.exclude};
}
function geminiIsDuplicate(x){
 const key=orderKey(x);return items.some(it=>it.importKey===key || (x.sku&&it.sku===x.sku&&it.brand===x.brand&&String(it.color||'').toUpperCase()===x.color.toUpperCase()&&String(it.size||'').toUpperCase()===x.size.toUpperCase()));
}
// v0.3.5.1: AI results are previews only. Never save until the user confirms.
async function geminiImage(file){
 if(!file.type.startsWith('image/'))throw Error('只接受圖片檔案');
 const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();return canvas.toDataURL('image/jpeg',0.82).split(',')[1];
}
function geminiDiagnosticText(payload, response){
 const d=payload?.diagnostic;
 if(!d)return `\n診斷：HTTP ${response.status}；Worker 未回傳診斷欄位，請確認已部署新版 worker.js。`;
 return '\n診斷資訊：'+JSON.stringify(d,null,2);
}
$('#geminiImportBtn').addEventListener('click',async()=>{
 const btn=$('#geminiImportBtn'),status=$('#geminiStatus'),files=[...$('#orderImages').files],url=SMART_WARDROBE_WORKER;
 if(!/^https:\/\/[a-z0-9.-]+(?:\:[0-9]+)?(?:\/[^?#]*)?$/i.test(url))return alert('請輸入 Cloudflare Worker 的 HTTPS 網址');
 if(!files.length)return alert('請先選擇訂單截圖');if(files.length>8)return alert('每次最多匯入 8 張截圖');
 btn.disabled=true;let pending=0,skipped=0;
 try{
  for(let i=0;i<files.length;i++){
   status.textContent=`AI 分析中：${i+1}/${files.length} 張…`;const base64=await geminiImage(files[i]);
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),45000);let response;
   try{response=await fetch(url+'/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:base64,mimeType:'image/jpeg',brand:$('#orderBrand').value}),signal:ctrl.signal})}finally{clearTimeout(timer)}
   const payload=await response.json().catch(()=>({error:'Worker 回傳格式錯誤'}));
   if(!response.ok)throw Error((payload.error||`HTTP ${response.status}`)+geminiDiagnosticText(payload,response));
   if(!Array.isArray(payload.items))throw Error('AI 未回傳商品陣列');
   for(const raw of payload.items.slice(0,40)){
    const x=geminiNormalize(raw,$('#orderBrand').value);
    if(!x.name||x.exclude||x.category==='排除'){skipped++;continue}
    if(geminiIsDuplicate(x)||orderDraft.some(y=>orderKey(y)===orderKey(x))){skipped++;continue}
    x.include=true;orderDraft.push(x);pending++;
   }
   renderOrderDraft(); // Keep already-recognized results if a later image fails.
  }
  status.textContent=`辨識完成：待確認 ${pending} 件，略過 ${skipped} 件。尚未加入衣櫃。`;
  alert(status.textContent+'\n請在下方檢查商品，最後按「確認加入衣櫃」。');
 }catch(err){renderOrderDraft();status.textContent='AI 匯入中斷：'+err.message+`\n已保留 ${pending} 件待確認商品，尚未新增衣物。`;}
 finally{btn.disabled=false}
});
$('#geminiUndoBtn').addEventListener('click',async()=>{
 const ids=JSON.parse(localStorage.getItem('sw-gemini-last-import')||'[]');if(!ids.length)return alert('沒有可復原的 AI 匯入紀錄');
 if(!confirm(`確定移除上一次 AI 自動新增的 ${ids.length} 件衣物？`))return;
 for(const id of ids)await del(STORE,id);localStorage.removeItem('sw-gemini-last-import');await load();$('#geminiStatus').textContent=`已復原 ${ids.length} 件衣物。`;
});
