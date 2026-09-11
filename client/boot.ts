import './style.css';
import('./main.js').catch(error => {
  console.error(error);
  document.querySelector('#loading')?.classList.add('hidden');
  const toast = document.querySelector('#toast');
  if (toast) { toast.textContent = 'The 3D engine could not start. Enable WebGL 2 and hardware acceleration, then reload.'; toast.classList.add('show'); }
});
