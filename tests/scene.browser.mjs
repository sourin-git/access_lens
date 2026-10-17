import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import * as THREE from 'three';

await mkdir('.scene-test-artifacts', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5175', '--strictPort'], { stdio: 'pipe' });
let serverOutput = '';
server.stdout.on('data', data => { serverOutput += data; });
server.stderr.on('data', data => { serverOutput += data; });
process.on('exit', () => server.kill());
const baseURL = 'http://127.0.0.1:5175';
for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(`${baseURL}/scene-test.html`)).ok) break; } catch { /* server is starting */ }
  if (attempt === 50 || server.exitCode !== null) throw new Error(`Test server did not start: ${serverOutput}`);
  await new Promise(resolve => setTimeout(resolve, 100));
}
// Chromium's GPU process also writes relative diagnostic files on Windows.
// Launch from the artifact directory, then restore paths for the actual tests.
const workspace = process.cwd();
let browser;
try {
  process.chdir(resolve('.scene-test-artifacts'));
  browser = await chromium.launch({
    headless:true,
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],
    env:{...process.env,CHROME_LOG_FILE:resolve('chromium.log')},
  });
} finally {process.chdir(workspace);}
const page = await browser.newPage({viewport:{width:1440,height:1200},deviceScaleFactor:1});
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if(message.type()==='error' && !message.text().includes('favicon')) errors.push(message.text()); });
await page.addInitScript(() => {
  const request = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  window.__sceneFrames = { pending:new Set(), count:0 };
  window.requestAnimationFrame = (callback) => {
    const id=request(time=>{window.__sceneFrames.pending.delete(id);window.__sceneFrames.count++;callback(time);});
    window.__sceneFrames.pending.add(id); return id;
  };
  window.cancelAnimationFrame = id => { window.__sceneFrames.pending.delete(id); cancel(id); };
});
const results=[];
async function check(label, fn) { await fn(); results.push(label); console.log('PASS '+label); }
try {
await page.goto(`${baseURL}/scene-test.html`);
await page.waitForFunction(()=>document.querySelector('#lifecycle').textContent.includes('mounted'));
await check('WebGL initialization and transparent canvas', async()=>{
  assert.equal(await page.locator('[data-access-lens-fallback]').count(),0);
  assert.equal(await page.locator('#scene').evaluate(c=>c.getContext('webgl2').getContextAttributes().alpha),true);
});
await page.screenshot({path:'.scene-test-artifacts/default.png',fullPage:true});
for (const profile of ['default','low-vision','dyslexia','motor','reduced-motion']) {
  await check('profile '+profile, async()=>{
    await page.selectOption('#profile',profile);
    await page.waitForTimeout(100);
    assert.ok((await page.locator('#profile-description').textContent()).length>20);
    await page.locator('#stage').screenshot({path:`.scene-test-artifacts/${profile}.png`});
  });
}
await check('reduced motion immediately cancels animation',async()=>{
  const first=await page.evaluate(()=>({pending:window.__sceneFrames.pending.size,count:window.__sceneFrames.count}));
  await page.waitForTimeout(200);
  const second=await page.evaluate(()=>({pending:window.__sceneFrames.pending.size,count:window.__sceneFrames.count}));
  assert.equal(first.pending,0); assert.deepEqual(second,first);
});
function elementPositions(rect) {
  const aspect=rect.width/rect.height;
  const camera=new THREE.PerspectiveCamera(38,aspect,.1,60);
  camera.position.z=Math.max(9.4,Math.max(2.8,5.2/aspect)/Math.tan(THREE.MathUtils.degToRad(19))*1.08);
  camera.lookAt(0,0,0);camera.updateMatrixWorld();
  return [['navigation',0,1.82],['hero',-1.18,.72],['body-text',-1.18,-.65],['hero-image',1.94,.04],['primary-button',-1.92,-1.6]].map(([id,x,y])=>{
    const v=new THREE.Vector3(x,y,.045).applyEuler(new THREE.Euler(-.045,-.11,0)).project(camera);
    return {id,x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};
  });
}
const positions=elementPositions(await page.locator('#scene').boundingBox().then(rect=>({left:rect.x,top:rect.y,width:rect.width,height:rect.height})));
await check('pointer raycasting for all five stable IDs',async()=>{
  for(const pos of positions) { await page.mouse.click(pos.x,pos.y); await page.waitForFunction(id=>document.querySelector('#selected').textContent===`Selected element: ${id}`,pos.id); }
});
await check('keyboard equivalent selection and clearing',async()=>{
  await page.locator('[data-element-id="hero"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#selected').textContent(),'Selected element: hero');
  await page.locator('#clear').focus(); await page.keyboard.press('Space');
  assert.equal(await page.locator('#selected').textContent(),'Selected element: none');
});
await check('reduced-motion static scan is functional',async()=>{
  await page.check('#scan');
  assert.equal(await page.evaluate(()=>window.__sceneFrames.pending.size),0);
  await page.locator('#stage').screenshot({path:'.scene-test-artifacts/reduced-scan.png'});
  await page.uncheck('#scan');
});
await check('animated scan and detected issue state',async()=>{
  await page.selectOption('#profile','default'); await page.check('#scan');
  await page.waitForTimeout(900); await page.locator('#stage').screenshot({path:'.scene-test-artifacts/scanning.png'});
  await page.waitForTimeout(3400); await page.locator('#stage').screenshot({path:'.scene-test-artifacts/detected.png'});
  await page.uncheck('#scan');
});
await check('container ResizeObserver works without window resize or explicit resize',async()=>{
  const viewport=page.viewportSize();
  await page.selectOption('#profile','reduced-motion');
  await page.check('#narrow');
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('#scene');
    return canvas.width===canvas.clientWidth && canvas.clientWidth<400 && canvas.height===canvas.clientHeight;
  });
  assert.deepEqual(page.viewportSize(),viewport);
  assert.equal(await page.locator('#stage').evaluate(e=>e.clientWidth),358);
  const size=await page.locator('#scene').evaluate(e=>({buffer:e.width,css:e.clientWidth}));
  assert.ok(Math.abs(size.buffer-size.css)<2);
  await page.locator('#stage').screenshot({path:'.scene-test-artifacts/narrow.png'});
  for(const position of elementPositions(await page.locator('#scene').boundingBox().then(rect=>({left:rect.x,top:rect.y,width:rect.width,height:rect.height})))) {
    await page.mouse.click(position.x,position.y);
    assert.equal(await page.locator('#selected').textContent(),`Selected element: ${position.id}`);
  }
  await page.locator('#stage').evaluate(element=>{element.style.width='720px';element.style.height='320px';});
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('#scene');
    return canvas.width===718 && canvas.height===318;
  });
  await page.click('#resize');
  assert.match(await page.locator('#lifecycle').textContent(),/Resize requested: 718 × 318/);
  await page.locator('#stage').evaluate(element=>{element.style.removeProperty('width');element.style.removeProperty('height');});
  await page.uncheck('#narrow');
});
await check('disposal cancels frames; repeat mounting works',async()=>{
  for(let i=0;i<3;i++) {
    await page.click('#dispose');assert.equal(await page.evaluate(()=>window.__sceneFrames.pending.size),0);
    assert.equal(await page.locator('[data-access-lens-fallback]').count(),0);
    await page.click('#remount');await page.waitForTimeout(60);
    assert.equal(await page.locator('[data-access-lens-fallback]').count(),0);
    assert.equal(await page.locator('#scene').evaluate(canvas=>{
      const gl=canvas.getContext('webgl2');
      return gl.getError();
    }),0,'Remounting must not produce WebGL errors');
  }
});
await check('forced fallback keyboard selection, state and cleanup',async()=>{
  await page.check('#fallback');
  assert.equal(await page.locator('[data-access-lens-fallback]').count(),1);
  const fallback=page.locator('[data-access-lens-fallback]');
  await fallback.getByRole('button',{name:'Hero image',exact:true}).focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#selected').textContent(),'Selected element: hero-image');
  await page.selectOption('#profile','low-vision'); await page.check('#scan');
  assert.match(await fallback.getByRole('status').textContent(),/low-vision.*Illustrative issues/);
  await page.screenshot({path:'.scene-test-artifacts/fallback.png',fullPage:true});
  await page.click('#clear');assert.match(await fallback.getByRole('status').textContent(),/Selected: none/);
  await page.click('#dispose');assert.equal(await page.locator('[data-access-lens-fallback]').count(),0);
  await page.uncheck('#fallback');assert.equal(await page.locator('[data-access-lens-fallback]').count(),0);
});
await check('OS reduced-motion preference on initialization and profile changes',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
  await page.waitForFunction(()=>document.querySelector('#lifecycle').textContent.includes('mounted'));
  assert.equal(await page.locator('#profile').inputValue(),'reduced-motion');
  for(const profile of ['default','low-vision','dyslexia','motor','reduced-motion']) {
    await page.selectOption('#profile',profile);
    assert.equal(await page.evaluate(()=>window.__sceneFrames.pending.size),0);
  }
});
await check('live OS preference changes stop motion and preserve the chosen visual profile',async()=>{
  await page.selectOption('#profile','motor');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>window.__sceneFrames.pending.size>0);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>window.__sceneFrames.pending.size===0);
  const count=await page.evaluate(()=>window.__sceneFrames.count);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__sceneFrames.count),count);
  assert.equal(await page.locator('#profile').inputValue(),'motor');
});
await check('public API call ordering, callback contract, repeated dispose and remount',async()=>{
  await page.click('#dispose');
  const result=await page.evaluate(async()=>{
    const {createAccessLensScene}=await import('/src/scene/createScene.ts');
    const {SELECTABLE_ELEMENTS}=await import('/src/scene/createWebsiteModel.ts');
    const profiles=['default','low-vision','dyslexia','motor','reduced-motion'];
    const expectedIds=['navigation','hero','body-text','hero-image','primary-button'];
    const ensure=(condition,message)=>{if(!condition) throw new Error(message);};
    ensure(JSON.stringify(SELECTABLE_ELEMENTS.map(element=>element.id))===JSON.stringify(expectedIds),'Stable IDs changed');
    const host=document.createElement('div');
    host.style.cssText='position:fixed;left:0;top:0;width:320px;height:240px;';
    const canvas=document.createElement('canvas');
    canvas.style.cssText='display:block;width:100%;height:100%;';
    host.append(canvas);document.body.append(host);
    const calls=[];
    const permutations=values=>values.length?values.flatMap((value,index)=>permutations(values.filter((_,i)=>i!==index)).map(rest=>[value,...rest])):[[]];
    const orders=permutations(['profile','scan','select','clear']);
    let permutationsChecked=0;
    try {
      for(const forceFallback of [false,true]) {
        canvas.dataset.accessLensForceFallback=String(forceFallback);
        const api=createAccessLensScene(canvas,{onSelectElement:id=>calls.push(id)});
        try {
          ensure(JSON.stringify(Object.keys(api).sort())===JSON.stringify(['setProfile','setScanActive','setSelectedElement','resize','dispose'].sort()),'Public API shape changed');
          const gl=forceFallback?null:canvas.getContext('webgl2');
          ensure(forceFallback||!!gl,'WebGL test unexpectedly unavailable');
          if(gl) ensure(gl.getError()===gl.NO_ERROR,'Mount must initialize cleanly');
          const pixels=gl?new Uint8Array(canvas.width*canvas.height*4):null;
          function snapshot() {
            if(!gl) return host.querySelector('[data-access-lens-fallback]').shadowRoot.querySelector('[role=status]').textContent;
            gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            ensure(gl.getError()===gl.NO_ERROR,'Scene operations must not produce WebGL errors');
            let hash=2166136261;
            for(const value of pixels) hash=Math.imul(hash^value,16777619);
            return hash;
          }
          for(const profile of profiles) {
            api.setProfile(profile);api.setScanActive(false);api.setSelectedElement(null);
            const idle=snapshot();
            api.setScanActive(true);api.setSelectedElement(null);
            const cleared=snapshot();
            api.setSelectedElement('hero-image');const selected=snapshot();
            ensure(selected!==cleared,`${profile}: selection should change the scene`);
            ensure(cleared!==idle,`${profile}: scan should change the scene`);
            for(const order of orders) {
              api.setScanActive(false);api.setSelectedElement(null);api.setProfile('default');
              let selection=null;
              for(const operation of order) {
                if(operation==='profile') api.setProfile(profile);
                if(operation==='scan') {api.setScanActive(true);api.setScanActive(false);api.setScanActive(true);}
                if(operation==='select') {api.setSelectedElement('hero-image');selection='hero-image';}
                if(operation==='clear') {api.setSelectedElement(null);selection=null;}
              }
              ensure(snapshot()===(selection?selected:cleared),`${forceFallback?'fallback':'WebGL'} ${profile}: order ${order} changed the result`);
              api.setSelectedElement('not-an-element');
              ensure(snapshot()===cleared,'Unknown selection ID must clear selection');
              api.setScanActive(false);
              ensure(snapshot()===idle,'Stopping scan must restore idle while selection stays cleared');
              permutationsChecked++;
            }
          }
          ensure(calls.length===0,'Programmatic setters must not emit selection callbacks');
          const button=host.querySelector('[data-access-lens-fallback]')?.shadowRoot.querySelector('button');
          api.dispose();api.dispose();
          if(gl) ensure(!gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL),'Disposal must reset texture unpack state');
          api.setProfile('motor');api.setScanActive(true);api.setSelectedElement('hero');api.resize();
          button?.click();
          ensure(calls.length===0,'Disposed listeners must not emit callbacks');
          ensure(!host.querySelector('[data-access-lens-fallback]'),'Fallback must be removed');
          ensure(window.__sceneFrames.pending.size===0,'Disposed scene must not schedule frames');
        } finally {api.dispose();}
        const remounted=createAccessLensScene(canvas,{onSelectElement:id=>calls.push(id)});
        try {remounted.setScanActive(true);remounted.setProfile('motor');remounted.setSelectedElement('hero');remounted.setSelectedElement(null);remounted.resize();}
        finally {remounted.dispose();remounted.dispose();}
      }
      return {permutationsChecked,callbacks:calls.length};
    } finally {host.remove();}
  });
  assert.deepEqual(result,{permutationsChecked:240,callbacks:0});
  await page.click('#remount');
});
await check('WebGL context loss produces selectable fallback',async()=>{
  await page.locator('#scene').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForSelector('[data-access-lens-fallback]');
  await page.locator('[data-access-lens-fallback]').getByRole('button',{name:'Navigation',exact:true}).click();
  assert.equal(await page.locator('#selected').textContent(),'Selected element: navigation');
});
assert.deepEqual(errors,[]);
await writeFile('.scene-test-artifacts/results.json',JSON.stringify({results,errors},null,2));
console.log('ALL '+results.length+' CHECKS PASSED');
} finally { await browser.close(); server.kill(); }
