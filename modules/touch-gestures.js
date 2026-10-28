// Safari/WKWebView can still smart-zoom despite touch-action: manipulation.
// Cancel only a stationary second single-finger tap, then restore its click.
// Do not cancel scrolling, long presses, text editing or multi-touch gestures.
export function installDoubleTapGuard(root){
 let gesture=null,lastTap=null;
 const editable=target=>!!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
 const reset=()=>{gesture=null;lastTap=null;};
 const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
 const start=event=>{
  if(event.touches.length!==1||editable(event.target)){reset();return;}
  const touch=event.touches[0];gesture={identifier:touch.identifier,clientX:touch.clientX,clientY:touch.clientY,time:event.timeStamp,target:event.target};
 };
 const move=event=>{if(!gesture||event.touches.length!==1||event.touches[0].identifier!==gesture.identifier||distance(gesture,event.touches[0])>10)reset();};
 const end=event=>{
  const tap=gesture;gesture=null;
  if(!tap||event.touches.length||event.defaultPrevented){lastTap=null;return;}
  const touch=Array.from(event.changedTouches).find(t=>t.identifier===tap.identifier);
  if(!touch||distance(tap,touch)>10||event.timeStamp-tap.time>300||editable(tap.target)){lastTap=null;return;}
  const current={clientX:touch.clientX,clientY:touch.clientY,time:event.timeStamp};
  const double=lastTap&&current.time-lastTap.time>=0&&current.time-lastTap.time<=350&&distance(current,lastTap)<=30;
  lastTap=current;
  if(!double||!event.cancelable)return;
  event.preventDefault();
  // Preventing touchend suppresses the compatibility click on iOS. Dispatch it
  // once, synchronously, so buttons and <summary> keep their normal action.
  const action=tap.target?.closest?.('button,a[href],summary,label,[role="button"]')||tap.target;
  if(action?.isConnected!==false&&typeof action?.click==='function')action.click();
 };
 const doubleClick=event=>{if(!editable(event.target)&&event.cancelable)event.preventDefault();};
 const listeners=[['touchstart',start,{capture:true,passive:true}],['touchmove',move,{capture:true,passive:true}],['touchend',end,{capture:true,passive:false}],['touchcancel',reset,{capture:true,passive:true}],['dblclick',doubleClick,{capture:true,passive:false}]];
 for(const [type,handler,options] of listeners)root.addEventListener(type,handler,options);
 return ()=>{for(const [type,handler,options] of listeners)root.removeEventListener(type,handler,options);reset();};
}
