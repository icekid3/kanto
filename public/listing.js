// public/listing.js — hero photo carousel for the guest-facing listing
// page (views/listing.js). Only loaded on that page (see layout.js's
// extraScript). Auto-advances, and pauses/restarts its timer on manual
// interaction (arrow or dot click) so it doesn't fight the visitor.
window.Kanto = window.Kanto || {};

(function () {
  function initCarousel(root) {
    var track = root.querySelector('.hero-slides');
    var slides = root.querySelectorAll('.hero-slide');
    var dots = root.querySelectorAll('[data-carousel-dot]');
    var prevBtn = root.querySelector('[data-carousel-prev]');
    var nextBtn = root.querySelector('[data-carousel-next]');
    var count = slides.length;
    if (!track || count < 2) return;

    var index = 0;
    var timer = null;

    function show(i) {
      index = (i + count) % count;
      track.style.transform = 'translateX(-' + index * 100 + '%)';
      for (var d = 0; d < dots.length; d++) {
        dots[d].classList.toggle('active', d === index);
      }
    }

    function next() {
      show(index + 1);
    }
    function prev() {
      show(index - 1);
    }
    function restartTimer() {
      if (timer) clearInterval(timer);
      timer = setInterval(next, 5000);
    }

    if (nextBtn)
      nextBtn.addEventListener('click', function () {
        next();
        restartTimer();
      });
    if (prevBtn)
      prevBtn.addEventListener('click', function () {
        prev();
        restartTimer();
      });
    for (var i = 0; i < dots.length; i++) {
      (function (dot, di) {
        dot.addEventListener('click', function () {
          show(di);
          restartTimer();
        });
      })(dots[i], i);
    }

    show(0);
    restartTimer();
  }

  var carousels = document.querySelectorAll('[data-carousel]');
  for (var c = 0; c < carousels.length; c++) initCarousel(carousels[c]);
})();
