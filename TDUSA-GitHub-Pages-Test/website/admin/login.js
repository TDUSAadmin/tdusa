import {configuredClient, checkAdmin} from './shared.js';
const form = document.querySelector('#login-form');
const message = document.querySelector('#message');
const submit = form.querySelector('button');
const show = (text) => { message.textContent = text; message.hidden = false; };
let client;
try { client = configuredClient(); }
catch (e) { show(e.message); submit.disabled = true; }
if (client) {
  checkAdmin(client).then(user => { if (user) location.replace('index.html'); }).catch(() => {});
  form.addEventListener('submit', async e => {
    e.preventDefault(); message.hidden = true; submit.disabled = true;
    const data = new FormData(form);
    try {
      const {error} = await client.auth.signInWithPassword({email:String(data.get('email')).trim(), password:String(data.get('password'))});
      if (error) throw new Error('Sign-in failed. Check your details and try again.');
      if (!await checkAdmin(client)) {
        await client.auth.signOut();
        throw new Error('This account is not authorized to use the TDUSA dashboard.');
      }
      location.replace('index.html');
    } catch (err) { show(err.message || 'Unable to sign in. Please try again.'); submit.disabled = false; }
  });
}
