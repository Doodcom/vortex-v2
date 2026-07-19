import { app } from 'electron';
app.whenReady().then(() => {
  console.log('App ready headless!');
  app.quit();
});
