import {configuredClient, checkAdmin} from './shared.js';
const loading = document.querySelector('#loading');
const dashboard = document.querySelector('#dashboard');
const message = document.querySelector('#message');
let navigating = false;
const login = () => { if (!navigating) { navigating = true; location.replace('login.html'); } };
(async () => {
  let client;
  try { client = configuredClient(); }
  catch (err) { loading.textContent = err.message; return; }
  try {
    const user = await checkAdmin(client);
    if (!user) { login(); return; }
    document.querySelector('#account').textContent = user.email || 'Administrator';
    dashboard.hidden = false; loading.hidden = true;
    document.querySelector('#logout').onclick = async () => {
      const {error} = await client.auth.signOut();
      if (error) { message.textContent = 'Could not sign out. Please try again.'; message.hidden = false; return; }
      login();
    };
    client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') login(); });
    const metrics = [
      ['exams','examinations','published'],['results','student_results',null],['images','media',null],
      ['events','events','published'],['announcements','announcements','published']
    ];
    const counts = await Promise.all(metrics.map(async ([id,table,status]) => {
      let q = client.from(table).select('id', {count:'exact',head:true});
      if (status) q = q.eq('status',status);
      const {count,error} = await q;
      if (!error && count != null) document.getElementById(id).textContent = count.toLocaleString();
      return error;
    }));
    if (counts.some(Boolean)) { message.textContent = 'Some counts could not be loaded. Check your project setup and permissions.'; message.hidden = false; }
  } catch { loading.textContent = 'Unable to verify access. Check your connection and try again.'; }
})();
