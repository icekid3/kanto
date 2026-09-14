// public/listing.js — hero photo carousel for the guest-facing listing
// page (views/listing.js). Only loaded on that page (see layout.js's
// extraScript). Auto-advances, and pauses/restarts its timer on manual
// interaction (arrow, dot, or a finger swipe) so it doesn't fight the
// visitor.
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

    // Finger-swipe support. Only decides "this is a horizontal swipe" once
    // the gesture's direction is clear (a few px of movement), and only
    // then calls preventDefault -- so a swipe that turns out to be a
    // vertical scroll still scrolls the (snap-scrolling) page normally,
    // and only a real left/right swipe steals the gesture from it.
    var touchStartX = 0;
    var touchStartY = 0;
    var touchDeltaX = 0;
    var touchIsHorizontal = null;

    root.addEventListener(
      'touchstart',
      function (e) {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchDeltaX = 0;
        touchIsHorizontal = null;
      },
      { passive: true }
    );

    root.addEventListener(
      'touchmove',
      function (e) {
        if (e.touches.length !== 1) return;
        var dx = e.touches[0].clientX - touchStartX;
        var dy = e.touches[0].clientY - touchStartY;
        if (touchIsHorizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
          touchIsHorizontal = Math.abs(dx) > Math.abs(dy);
        }
        if (touchIsHorizontal) {
          touchDeltaX = dx;
          e.preventDefault();
        }
      },
      { passive: false }
    );

    root.addEventListener('touchend', function () {
      if (touchIsHorizontal && Math.abs(touchDeltaX) > 40) {
        if (touchDeltaX < 0) next();
        else prev();
        restartTimer();
      }
      touchIsHorizontal = null;
      touchDeltaX = 0;
    });

    show(0);
    restartTimer();
  }

  var carousels = document.querySelectorAll('[data-carousel]');
  for (var c = 0; c < carousels.length; c++) initCarousel(carousels[c]);

  // The hero and every snap-section size themselves as "one screen minus
  // the sticky header" via the --header-h custom property below (see
  // styles.css). The header's real rendered height (nav padding + button
  // sizing) doesn't exactly match a hardcoded guess, and even a few
  // pixels of drift compounds section over section, so each snap lands a
  // little short/long of a full page instead of exactly on it. Measuring
  // the header for real and keeping it in sync (font load, resize, nav
  // wrapping to a second line on narrow screens) keeps every section's
  // height pixel-accurate to the space actually available beneath it.
  var header = document.querySelector('header.site');
  if (header && window.ResizeObserver) {
    var setHeaderHeight = function () {
      document.documentElement.style.setProperty('--header-h', header.getBoundingClientRect().height + 'px');
    };
    setHeaderHeight();
    new ResizeObserver(setHeaderHeight).observe(header);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setHeaderHeight);
  }
})();
