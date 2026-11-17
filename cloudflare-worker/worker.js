// Deploy as Cloudflare Worker; add GEMINI_API_KEY as an encrypted Secret.
const MODEL='gemini-3.5-flash-lite';
export default {async fetch(request,env){
 const origin=request.headers.get('Origin')||'';
 const allowed=(env.ALLOWED_ORIGIN||'').replace(/\/$/,'');
 const cors={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
 const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...cors,'Content-Type':'application/json;charset=utf-8'}});
 const url=new URL(request.url);
 if(request.method==='GET'&&url.pathname==='/health')return new Response(JSON.stringify({status:'ok',model:MODEL,geminiKeyConfigured:!!env.GEMINI_API_KEY,allowedOriginConfigured:!!allowed}),{headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});
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
 if(request.method!=='POST'||new URL(request.url).pathname!=='/analyze')return reply({error:'Not found'},404);
 if(!env.GEMINI_API_KEY)return reply({error:'請先設定 GEMINI_API_KEY Secret'},503);
 const length=Number(request.headers.get('content-length')||0);if(length>6_000_000)return reply({error:'圖片過大'},413);
 let data;try{data=await request.json()}catch{return reply({error:'無效 JSON'},400)}
 if(!data||typeof data.image!=='string'||data.image.length>5_500_000||!/^[A-Za-z0-9+/=]+$/.test(data.image)||data.mimeType!=='image/jpeg')return reply({error:'圖片格式不正確'},400);
 const prompt=`你是台灣 UNIQLO/GU 購物訂單辨識助手。從圖片逐件擷取實際商品，輸出 JSON 物件 {"items":[{"name":"","brand":"GU","orderId":"","date":"YYYY-MM-DD","sku":"","color":"","size":"","price":null,"quantity":1,"category":"上衣","confidence":0.0,"exclude":false}]}。品牌可為 GU/UNIQLO/其他。category 必須是 上衣、褲裝、裙裝、洋裝、外套、鞋子、帽子、襪子／褲襪、飾品、其他配件、排除 之一。不要猜看不到的資料，無法確認時留空；價格未知用 null，勿將訂單總額當單價。confidence 是你對名稱、顏色、尺寸和商品歸屬都正確的整體信心，0-1。購物袋、洗沐用品、贈品、非衣物設定 exclude=true。內衣褲可設排除。辨識多個訂單時不可混淆訂單編號。若同張圖有相同商品跨段重複出現，只列一次。只輸出 JSON。`;
 const payload={contents:[{parts:[{text:prompt},{inline_data:{mime_type:'image/jpeg',data:data.image}}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1,maxOutputTokens:4096}};
 try{const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),35000);let r;try{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify(payload),signal:ctrl.signal})}finally{clearTimeout(timeout)}
 const body=await r.json();if(!r.ok)return reply({error:r.status===429?'Gemini 免費額度或速率限制已達上限':`Gemini API 錯誤 ${r.status}: ${String(body.error?.message||'').slice(0,160)}`,diagnostic:{model:MODEL,geminiStatus:r.status,colo:request.cf?.colo||'unknown',imageMimeType:data.mimeType,imageBase64Length:data.image.length,workerVersion:'0.3.5.1'}},r.status===429?429:502);
 const text=body.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';const parsed=JSON.parse(text);return reply({items:Array.isArray(parsed.items)?parsed.items:[]});
 }catch(e){return reply({error:e.name==='AbortError'?'Gemini 回應逾時':'AI 回應解析失敗：'+e.message},502)}
 }};
