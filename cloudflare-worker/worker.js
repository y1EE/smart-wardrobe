// Deploy as Cloudflare Worker; add GEMINI_API_KEY as an encrypted Secret.
const MODEL='gemini-3.5-flash-lite';
const OPENAI_DEFAULT_MODEL='gpt-6-luna';
export default {async fetch(request,env){
 const origin=request.headers.get('Origin')||'';
 const allowed=(env.ALLOWED_ORIGIN||'').replace(/\/$/,'');
 const cors={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
 const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...cors,'Content-Type':'application/json;charset=utf-8'}});
 const url=new URL(request.url);
 if(request.method==='GET'&&url.pathname==='/health')return new Response(JSON.stringify({status:'ok',model:MODEL,geminiKeyConfigured:!!env.GEMINI_API_KEY,openaiKeyConfigured:!!env.OPENAI_API_KEY,openaiModel:env.OPENAI_MODEL||OPENAI_DEFAULT_MODEL,allowedOriginConfigured:!!allowed}),{headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});
 // This endpoint is not accessible by browsing a URL: a separate secret header is required.
 if(request.method==='GET'&&url.pathname==='/test-gemini'){
  if(!env.DIAGNOSTIC_TOKEN||request.headers.get('X-Diagnostic-Token')!==env.DIAGNOSTIC_TOKEN)return new Response('Not found',{status:404});
  try{
   const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:'請只回覆：Gemini API 測試成功'}]}]})});
   const result=await r.json();return new Response(JSON.stringify({httpStatus:r.status,success:r.ok,message:r.ok?result.candidates?.[0]?.content?.parts?.[0]?.text:result.error?.message}),{headers:{'Content-Type':'application/json;charset=utf-8'}});
  }catch(e){return new Response(JSON.stringify({success:false,message:String(e.message||e)}),{status:502,headers:{'Content-Type':'application/json;charset=utf-8'}})}
 }
 if(!allowed||origin!==allowed)return new Response('Origin not allowed',{status:403});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method==='POST'&&url.pathname==='/official-photo'){
  let input;try{input=await request.json()}catch{return reply({error:'無效 JSON'},400)}
  const brand=String(input.brand||'').toUpperCase();if(!['GU','UNIQLO'].includes(brand))return reply({message:'目前僅支援 GU／UNIQLO 官方網站'});
  const sku=String(input.sku||'').replace(/[^0-9]/g,'').slice(0,12);
  const raw=String(input.productUrl||'').trim();
  const allowedHost=brand==='GU'?'gu-global.com':'uniqlo.com';
  const validHost=h=>h===allowedHost||h.endsWith('.'+allowedHost);
  // Only official HTTPS pages. Do not proxy arbitrary URLs or fetch redirects to third parties.
  async function metadata(page){
   let u;try{u=new URL(page)}catch{return null}
   if(u.protocol!=='https:'||!validHost(u.hostname))return null;
   const r=await fetch(u.toString(),{redirect:'manual',headers:{'Accept':'text/html','User-Agent':'Mozilla/5.0 (compatible; SmartWardrobe/0.3.6)'}});
   if(!r.ok||!String(r.headers.get('content-type')||'').includes('text/html'))return null;
   const html=(await r.text()).slice(0,850000);
   const get=(key)=>{const escaped=key;const patterns=[new RegExp('<meta[^>]+(?:property|name)=["\']'+escaped+'["\'][^>]+content=["\']([^"\']+)', 'i'),new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']'+escaped+'["\']','i')];for(const re of patterns){const m=html.match(re);if(m)return m[1].replace(/&amp;/g,'&')}return ''};
   const image=get('og:image')||get('twitter:image'),title=get('og:title')||get('twitter:title');
   if(!image)return null;let img;try{img=new URL(image,u)}catch{return null}
   // Only return HTTPS official/CDN image URLs; browser verifies and user approves image.
   if(img.protocol!=='https:'||!(/(^|\.)(uniqlo\.com|gu-global\.com|fastretailing\.com|uniqlo\.jp|gu-global\.jp)$/.test(img.hostname)))return null;
   return {imageUrl:img.toString(),productUrl:u.toString(),title,source:'official-page'};
  }
  if(raw){let u;try{u=new URL(raw)}catch{return reply({error:'商品頁網址格式不正確'},400)}
   if(u.protocol!=='https:'||!validHost(u.hostname))return reply({error:'請使用所選品牌的官方 HTTPS 商品頁網址'},400);
   const m=await metadata(u.toString());return reply(m||{message:'官方頁面沒有可讀取的商品照片，可能已下架或禁止自動讀取'});
  }
  if(!sku)return reply({message:'未辨識到商品編號，請開啟官方搜尋並貼上商品頁網址'});
  // Official storefront search pages vary by region; these are candidates, not guaranteed product URLs.
  const candidates=brand==='GU'?[`https://www.gu-global.com/tw/zh_TW/search?q=${sku}`]:[`https://www.uniqlo.com/tw/zh_TW/search?q=${sku}`];
  for(const page of candidates){
   try{
    const r=await fetch(page,{redirect:'manual',headers:{'Accept':'text/html'}});
    if(!r.ok||!String(r.headers.get('content-type')||'').includes('text/html'))continue;
    const html=(await r.text()).slice(0,850000);
    const links=[...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1].replace(/&amp;/g,'&'));
    for(const link of links.slice(0,350)){
     let u;try{u=new URL(link,page)}catch{continue}
     if(!validHost(u.hostname)||!u.pathname.includes(sku)||!/product|goods|item/i.test(u.pathname))continue;
     const m=await metadata(u.toString());if(m)return reply(m);
    }
   }catch{}
  }
  return reply({message:'未能自動確認相同商品編號的官方照片。請按「開啟官方搜尋」，找到商品頁後貼入網址再讀取。'});
 }
 if(request.method!=='POST'||new URL(request.url).pathname!=='/analyze')return reply({error:'Not found'},404);
 if(!env.OPENAI_API_KEY&&!env.GEMINI_API_KEY)return reply({error:'請先設定 OPENAI_API_KEY 或 GEMINI_API_KEY Secret'},503);
 const length=Number(request.headers.get('content-length')||0);if(length>6_000_000)return reply({error:'圖片過大'},413);
 let data;try{data=await request.json()}catch{return reply({error:'無效 JSON'},400)}
 if(!data||typeof data.image!=='string'||data.image.length>5_500_000||!/^[A-Za-z0-9+/=]+$/.test(data.image)||data.mimeType!=='image/jpeg')return reply({error:'圖片格式不正確'},400);
 const prompt=`你是台灣 UNIQLO/GU 購物訂單辨識助手。從圖片逐件擷取實際商品，輸出 JSON 物件 {"items":[{"name":"","brand":"GU","orderId":"","date":"YYYY-MM-DD","sku":"","color":"","size":"","price":null,"quantity":1,"category":"上衣","confidence":0.0,"exclude":false}]}。品牌可為 GU/UNIQLO/其他。category 必須是 上衣、褲裝、裙裝、洋裝、外套、鞋子、帽子、襪子／褲襪、飾品、其他配件、排除 之一。不要猜看不到的資料，無法確認時留空；價格未知用 null，勿將訂單總額當單價。confidence 是你對名稱、顏色、尺寸和商品歸屬都正確的整體信心，0-1。購物袋、洗沐用品、贈品、非衣物設定 exclude=true。內衣褲可設排除。辨識多個訂單時不可混淆訂單編號。若同張圖有相同商品跨段重複出現，只列一次。只輸出 JSON。`;
 const diagnostic={colo:request.cf?.colo||'unknown',imageMimeType:data.mimeType,imageBase64Length:data.image.length,workerVersion:'0.3.6.2'};
 const callWithTimeout=async(url,options)=>{const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),35000);try{return await fetch(url,{...options,signal:ctrl.signal})}finally{clearTimeout(timer)}};
 const parseItems=(text)=>{const parsed=JSON.parse(text);if(!parsed||!Array.isArray(parsed.items))throw Error('AI 回傳缺少 items 陣列');return parsed.items.slice(0,40)};
 let openaiFailure=null;
 if(env.OPENAI_API_KEY){
  const model=env.OPENAI_MODEL||OPENAI_DEFAULT_MODEL;
  try{
   const r=await callWithTimeout('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.OPENAI_API_KEY},body:JSON.stringify({model,messages:[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+data.image,detail:'high'}}]}],response_format:{type:'json_object'},temperature:0,max_tokens:4096})});
   const body=await r.json();
   if(r.ok){const items=parseItems(body.choices?.[0]?.message?.content||'');return reply({items,provider:'openai',model,usage:body.usage||null})}
   openaiFailure={status:r.status,message:String(body.error?.message||'OpenAI API error').slice(0,240),model};
  }catch(e){openaiFailure={message:String(e.message||e).slice(0,240),model}}
 }
 // Fallback only for provider/model/service failures, not for malformed user input.
 if(env.GEMINI_API_KEY){
  const payload={contents:[{parts:[{text:prompt},{inline_data:{mime_type:'image/jpeg',data:data.image}}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1,maxOutputTokens:4096}};
  try{
   const r=await callWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify(payload)});
   const body=await r.json();
   if(r.ok){const text=body.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';return reply({items:parseItems(text),provider:'gemini',model:MODEL,usage:body.usageMetadata||null,fallbackFrom:openaiFailure?{status:openaiFailure.status,model:openaiFailure.model}:null})}
   return reply({error:'GPT 與 Gemini 均無法完成辨識',openaiError:openaiFailure,geminiError:{status:r.status,message:String(body.error?.message||'').slice(0,200)},diagnostic},502);
  }catch(e){return reply({error:'GPT 與 Gemini 均無法完成辨識',openaiError:openaiFailure,geminiError:{message:String(e.message||e)},diagnostic},502)}
 }
 return reply({error:'OpenAI 辨識失敗',openaiError:openaiFailure,diagnostic},502);
 }};
