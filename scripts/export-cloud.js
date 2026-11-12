// Chạy trong DevTools Console của trang NetWatch cũ, sau khi đăng nhập.
// Chỉ đọc dữ liệu; không thay đổi cấu hình hay khóa router.
(async()=>{
 const get=async path=>{const r=await fetch(path);if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
 const {projects}=await get('/api/projects');const snapshots=[];
 for(const project of projects)snapshots.push(await get('/api/dashboard?hours=24&project='+encodeURIComponent(project.id)));
 const blob=new Blob([JSON.stringify({format:'netwatch-cloud-export-v1',exportedAt:Date.now(),projects,snapshots})],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='netwatch-cloud-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
})();
