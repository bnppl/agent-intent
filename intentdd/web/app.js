'use strict';
const $ = selector => document.querySelector(selector);
const token = $('meta[name="intent-dd-token"]').content;
let workspace, selected, busy = false;
function node(tag, text, className) { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(className)n.className=className; return n; }
function status(message, error=false) { $('#status').textContent=message; $('#status').classList.toggle('error',error); }
async function request(path, value) {
 const result=await fetch(path, value===undefined ? {cache:'no-store'} : {method:'POST',headers:{'Content-Type':'application/json','X-IntentDD-Token':token},body:JSON.stringify(value)});
 const body=await result.json(); if(!result.ok)throw Error(body.error||'Request failed'); return body;
}
async function refresh(message) {
 try { workspace=await request('/api/workspace'); selected=workspace.scenarios.find(s=>s.id===selected?.id)||workspace.scenarios.find(s=>s.path===selected?.path&&s.name===selected?.name)||workspace.scenarios[0]; render(); status(message||'Repository loaded. Annotations write to disk; stage changes explicitly.'); }
 catch(error){status(error.message,true); $('#approvalForm').hidden=true; $('#intentToggle').disabled=true;}
}
function render() {
 $('#repo').textContent=workspace.root; $('#count').textContent=workspace.scenarios.length; $('#reviewCount').textContent=workspace.review.changes.length?'('+workspace.review.changes.length+')':'';
 renderList(); renderSelection(); renderReview();
}
function renderList() {
 const q=$('#search').value.toLowerCase();const list=$('#scenarios');list.replaceChildren();
 for(const s of workspace.scenarios.filter(s=>(s.name+' '+s.path).toLowerCase().includes(q))) {
  const b=node('button',undefined,'scenario'+(s.id===selected?.id?' active':''));b.setAttribute('aria-pressed',s.id===selected?.id?'true':'false');b.append(node('span',s.intent?'◆ INTENT':'UNMARKED','badge'+(s.intent?'':' plain')),node('b',s.name),node('div',s.id,'path'));b.onclick=()=>{selected=s;renderList();renderSelection();};list.append(b);
 } if(!list.children.length)list.append(node('div','No matching scenarios. Add a .feature file under a configured root.','empty'));
}
function renderSelection() {
 $('#selectionEmpty').hidden=Boolean(selected); $('#selection').hidden=!selected;if(!selected)return;
 $('#kind').textContent=selected.keyword+' / '+(selected.inheritedIntent?'inherited protection':'scenario annotation'); $('#name').textContent=selected.name;$('#path').textContent=selected.id;$('#source').textContent=selected.source;
 $('#intentToggle').checked=selected.intent; $('#intentToggle').disabled=busy||selected.inheritedIntent;
 $('#classification').textContent=selected.intent?'HUMAN REVIEW REQUIRED':'AI EDITABLE';
 $('#annotationHint').textContent=selected.inheritedIntent?'Intent comes from a Feature, Rule, or Examples tag. Edit the parent tag in source; the commit still requires review.':'Toggle to add or remove @intent in this scenario’s source. Changes are not automatically staged or committed.';
 $('#glueRoots').replaceChildren(...workspace.config.glue_roots.map(p=>node('code',p)));
}
function renderReview() {
 const r=workspace.review; $('#reviewStatus').textContent=r.approved&&r.requiresApproval?'This exact staged revision has a local human approval.':r.requiresApproval?'A protected contract, glue, or verification-control change requires review.':'No protected changes are staged.';
 $('#revision').textContent='HEAD '+r.revision.head+' / INDEX TREE '+r.revision.tree;
 $('#changedFiles').replaceChildren(...r.changes.map(c=>{const n=node('div',undefined,'changed');n.append(node('code',c.path),node('span',c.change+' · '+c.category,'muted'));return n;}));
 $('#diff').textContent=workspace.diff||'No staged diff.';$('#approvalForm').hidden=!r.requiresApproval||r.approved;
}
$('#intentToggle').onchange=async()=>{if(busy||!selected)return;busy=true;const s=selected,enabled=$('#intentToggle').checked;renderSelection();try{await request('/api/annotation',{path:s.path,line:s.line,sourceHash:s.sourceHash,enabled});await refresh('Saved @intent annotation directly to source. Stage the change when ready.');}catch(e){status(e.message,true);}finally{busy=false;renderSelection();}};
$('#approvalForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await request('/api/approval',{revision:workspace.review.revision,reviewer:$('#reviewer').value,reason:$('#reason').value,acknowledgement:$('#acknowledgement').value});$('#acknowledgement').value='';await refresh('Approved the exact staged revision. Commit without changing the index.');}catch(error){status(error.message,true);}finally{b.disabled=false;}};
$('#reload').onclick=()=>refresh();$('#search').oninput=()=>workspace&&renderList();
for(const name of ['library','review','architecture'])$('#'+name+'Tab').onclick=()=>{for(const other of ['library','review','architecture']){$('#'+other).hidden=name!==other;$('#'+other+'Tab').classList.toggle('active',name===other);}};
refresh();
