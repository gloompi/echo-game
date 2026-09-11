import test from 'node:test';
import assert from 'node:assert/strict';
import { Connection } from '../client/network.js';
import type { GameTransport } from '../client/transport.js';
import type { Snapshot } from '../shared/types.js';
class FakeTransport implements GameTransport {
  bufferedAmount=0; sent:string[]=[]; url=''; closed=0; deliver: (text:string)=>void=()=>{}; disconnected:()=>void=()=>{}; accept=true;
  async connect(url:string,message:(text:string)=>void,closed:()=>void):Promise<void>{this.url=url;this.deliver=message;this.disconnected=closed;}
  sendReliable(text:string){if(this.accept)this.sent.push(text);return this.accept;}
  sendLatest(text:string){return this.sendReliable(text);}
  close(){this.closed++;}
}
const locationDescriptor=Object.getOwnPropertyDescriptor(globalThis,'location');
Object.defineProperty(globalThis,'location',{configurable:true,value:{protocol:'https:',host:'local.example',origin:'https://local.example',hash:'#key=secret'}});
test.after(()=>{if(locationDescriptor)Object.defineProperty(globalThis,'location',locationDescriptor);else Reflect.deleteProperty(globalThis,'location');});
test('same-origin secure socket sends fragment access key in join message',async()=>{const wire=new FakeTransport(),c=new Connection(()=>{},()=>{},()=>{},()=>wire);try{c.connect({type:'join',mode:'create',name:'A'});await Promise.resolve();assert.equal(wire.url,'wss://local.example/socket');assert.equal(JSON.parse(wire.sent[0]).accessKey,'secret');assert.ok(!wire.url.includes('secret'));}finally{c.close();}});
test('rejected host action is nonfatal',async()=>{const wire=new FakeTransport(),warnings:string[]=[],failures:string[]=[];const c=new Connection(()=>{},s=>failures.push(s),s=>warnings.push(s),()=>wire);try{c.connect({type:'join',mode:'create',name:'A'});await Promise.resolve();wire.deliver(JSON.stringify({type:'error',fatal:false,message:'Only host'}));assert.deepEqual(warnings,['Only host']);assert.deepEqual(failures,[]);assert.equal(wire.closed,0);}finally{c.close();}});
test('old connection callbacks cannot replace a new room',async()=>{const wires=[new FakeTransport(),new FakeTransport()];let index=0,count=0;const c=new Connection(()=>count++,()=>{},()=>{},()=>wires[index++]);try{c.connect({type:'join',mode:'create',name:'A'});await Promise.resolve();c.connect({type:'join',mode:'create',name:'A'});await Promise.resolve();wires[0].deliver(JSON.stringify({type:'snapshot',now:1} as Snapshot));assert.equal(count,0);wires[1].deliver(JSON.stringify({type:'snapshot',now:2} as Snapshot));assert.equal(count,1);}finally{c.close();}});
test('congestion closes rather than queuing unlimited inputs',async()=>{const wire=new FakeTransport(),failures:string[]=[];const c=new Connection(()=>{},s=>failures.push(s),()=>{},()=>wire);try{c.connect({type:'join',mode:'create',name:'A'});await Promise.resolve();wire.accept=false;wire.bufferedAmount=70_000;assert.equal(c.send({type:'start'}),false);assert.equal(failures.length,1);assert.equal(wire.closed,1);}finally{c.close();}});
test('invite refreshes public URL registered after joining and retains key',async()=>{const saved=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({publicUrl:'https://friends.trycloudflare.com'}),{status:200});const c=new Connection(()=>{},()=>{});try{assert.equal(await c.invite('ABC234'),'https://friends.trycloudflare.com/?room=ABC234#key=secret');}finally{c.close();globalThis.fetch=saved;}});
