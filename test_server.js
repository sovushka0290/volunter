import fetch from 'node-fetch'; // if available, or use node built-in
import http from 'http';

async function run() {
  const { default: app } = await import('./src/server.js');
  const server = app.listen(3000, async () => {
    try {
      console.log('Server started');
      const r1 = await fetch('http://localhost:3000/api/public/events');
      console.log('Events Status:', r1.status);
      console.log('Events Body:', await r1.text());
      
      const r2 = await fetch('http://localhost:3000/api/admin/questionnaires');
      console.log('Admin Status:', r2.status);
      console.log('Admin Body:', await r2.text());
      
    } catch (e) {
      console.error(e);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}
run();
