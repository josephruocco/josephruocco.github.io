const walkthroughButtons = document.querySelectorAll('[data-play]');

for (const button of walkthroughButtons) {
  button.addEventListener('click', () => {
    const picture = document.querySelector(`[data-walkthrough-image="${button.dataset.play}"]`);
    const playing = button.getAttribute('aria-pressed') === 'true';
    picture.src = playing ? button.dataset.poster : button.dataset.gif;
    picture.style.marginTop = playing ? '' : '0';
    picture.closest('.image-window').classList.toggle('playing', !playing);
    button.setAttribute('aria-pressed', String(!playing));
    button.textContent = playing ? '▶ Play walkthrough' : '■ Stop walkthrough';
  });
}

const imageDialog = document.querySelector('#image-dialog');
const dialogImage = imageDialog.querySelector('img');
for (const link of document.querySelectorAll('[data-lightbox]')) {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (typeof imageDialog.showModal !== 'function') return;
    event.preventDefault();
    dialogImage.src = link.href;
    dialogImage.alt = link.querySelector('img')?.alt || link.textContent.trim();
    imageDialog.showModal();
  });
}
imageDialog.querySelector('button').addEventListener('click', () => imageDialog.close());
imageDialog.addEventListener('click', event => {
  if (event.target === imageDialog) imageDialog.close();
});
