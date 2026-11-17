/* SelfWAM project page — small interactions */
(function () {
  'use strict';

  /* ---- compact navigation + reading progress --------------------- */
  var nav = document.querySelector('.nav');
  var navToggle = document.querySelector('.nav-toggle');
  var progress = document.querySelector('.scroll-progress');

  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open navigation');
  }

  if (nav && navToggle) {
    navToggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeNav();
    });
  }

  function updateProgress() {
    if (!progress) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progress.style.transform = 'scaleX(' + ratio + ')';
  }
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);

  /* ---- copy BibTeX ------------------------------------------------ */
  window.copyBib = function (btn) {
    var pre = document.getElementById('bib');
    if (!pre) return;
    // text without the button label
    var clone = pre.cloneNode(true);
    var b = clone.querySelector('.copy-btn');
    if (b) b.remove();
    var text = clone.textContent.trim();
    var done = function () {
      var t = btn.textContent;
      btn.textContent = 'copied ✓';
      btn.style.color = 'var(--accent)';
      setTimeout(function () { btn.textContent = t; btn.style.color = ''; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  };

  /* ---- synchronized task videos + lazy playback ------------------ */
  var vids = Array.prototype.slice.call(document.querySelectorAll('video.loop-vid'));

  function safePlay(video) {
    var play = video.play();
    if (play && play.catch) play.catch(function () {});
  }

  function waitForVideo(video) {
    if (video.readyState >= 2) return Promise.resolve();
    return new Promise(function (resolve) {
      function done() {
        video.removeEventListener('loadeddata', done);
        video.removeEventListener('error', done);
        resolve();
      }
      video.addEventListener('loadeddata', done);
      video.addEventListener('error', done);
    });
  }

  try {
    var groupedVideos = [];
    var groups = Array.prototype.map.call(
      document.querySelectorAll('#action .task-block'),
      function (block) {
        var group = {
          block: block,
          videos: Array.prototype.slice.call(block.querySelectorAll('video.loop-vid')),
          ready: false,
          visible: false,
          resetting: false
        };
        if (!group.videos.length) return null;

        group.master = group.videos[0];
        group.videos.forEach(function (video) {
          video.autoplay = false;
          video.loop = false;
          video.muted = true;
          groupedVideos.push(video);
        });

        group.playFromStart = function () {
          if (!group.ready || !group.visible || group.resetting) return;
          group.resetting = true;
          group.videos.forEach(function (video) {
            video.pause();
            video.currentTime = 0;
          });
          group.resetting = false;
          group.videos.forEach(safePlay);
        };

        Promise.all(group.videos.map(waitForVideo)).then(function () {
          group.ready = true;
          group.playFromStart();
        });

        group.master.addEventListener('ended', group.playFromStart);
        group.master.addEventListener('timeupdate', function () {
          if (!group.visible || group.resetting) return;
          var masterTime = group.master.currentTime;
          group.videos.slice(1).forEach(function (video) {
            if (Math.abs(video.currentTime - masterTime) > 0.075) {
              video.currentTime = masterTime;
            }
          });
        });

        block._videoSyncGroup = group;
        return group;
      }
    ).filter(Boolean);

    if ('IntersectionObserver' in window) {
      var groupObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var group = entry.target._videoSyncGroup;
          if (!group) return;
          group.visible = entry.isIntersecting;
          if (group.visible) {
            group.playFromStart();
          } else {
            group.videos.forEach(function (video) { video.pause(); });
          }
        });
      }, { rootMargin: '200px' });
      groups.forEach(function (group) { groupObserver.observe(group.block); });
    } else {
      groups.forEach(function (group) {
        group.visible = true;
        group.playFromStart();
      });
    }

    var looseVideos = vids.filter(function (video) {
      return groupedVideos.indexOf(video) === -1;
    });
    looseVideos.forEach(function (video) {
      video.autoplay = true;
      video.muted = true;
      safePlay(video);
    });

    if ('IntersectionObserver' in window) {
      var looseObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) safePlay(entry.target);
          else entry.target.pause();
        });
      }, { rootMargin: '200px' });
      looseVideos.forEach(function (video) { looseObserver.observe(video); });
    }
  } catch (err) {}

  /* ---- real-robot horizontal rail ------------------------------- */
  var realRail = document.querySelector('.real-rail');
  var realPrev = document.querySelector('.real-page-prev');
  var realNext = document.querySelector('.real-page-next');
  var realPageCurrent = document.querySelector('.real-page-current');
  var realPageTotal = document.querySelector('.real-page-total');
  if (realRail && realPrev && realNext && realPageCurrent && realPageTotal) {
    var realPagePoints = [];
    var realPageIndex = 0;

    function railMaxScroll() {
      return Math.max(0, realRail.scrollWidth - realRail.clientWidth);
    }

    function buildRealPages() {
      var max = railMaxScroll();
      var railLeft = realRail.getBoundingClientRect().left;
      var points = [0];
      Array.prototype.forEach.call(realRail.querySelectorAll('.real-card'), function (card) {
        var point = card.getBoundingClientRect().left - railLeft + realRail.scrollLeft;
        point = Math.max(0, Math.min(max, point));
        if (points.every(function (existing) { return Math.abs(existing - point) > 1; })) {
          points.push(point);
        }
      });
      if (points.every(function (point) { return Math.abs(point - max) > 1; })) points.push(max);
      realPagePoints = points.sort(function (a, b) { return a - b; });
    }

    function updateRealPager() {
      if (!realPagePoints.length) buildRealPages();
      var nearest = 0;
      realPagePoints.forEach(function (point, index) {
        if (Math.abs(point - realRail.scrollLeft) < Math.abs(realPagePoints[nearest] - realRail.scrollLeft)) {
          nearest = index;
        }
      });
      realPageIndex = nearest;
      realPageCurrent.textContent = ('0' + (realPageIndex + 1)).slice(-2);
      realPageTotal.textContent = ('0' + realPagePoints.length).slice(-2);
      realPrev.disabled = realPageIndex === 0;
      realNext.disabled = realPageIndex === realPagePoints.length - 1;
    }

    function turnRealPage(direction) {
      buildRealPages();
      updateRealPager();
      var nextIndex = Math.max(0, Math.min(realPagePoints.length - 1, realPageIndex + direction));
      realRail.scrollTo({ left: realPagePoints[nextIndex], behavior: 'smooth' });
    }

    realPrev.addEventListener('click', function () { turnRealPage(-1); });
    realNext.addEventListener('click', function () { turnRealPage(1); });
    realRail.addEventListener('scroll', updateRealPager, { passive: true });
    window.addEventListener('resize', function () {
      buildRealPages();
      updateRealPager();
    });
    buildRealPages();
    updateRealPager();
  }

  /* ---- active nav link on scroll ---------------------------------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  var map = {};
  links.forEach(function (l) {
    l.addEventListener('click', closeNav);
    var id = l.getAttribute('href');
    if (id && id.charAt(0) === '#') {
      var sec = document.querySelector(id);
      if (sec) map[id] = { link: l, sec: sec };
    }
  });
  if ('IntersectionObserver' in window && Object.keys(map).length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('active'); });
          for (var id in map) {
            if (map[id].sec === e.target) map[id].link.classList.add('active');
          }
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    for (var id in map) spy.observe(map[id].sec);
  }
})();
