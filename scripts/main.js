// scripts/main.js
document.addEventListener("DOMContentLoaded", function () {
  const navbar   = document.querySelector(".navbar");
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const sections = Array.from(document.querySelectorAll("main section[id]"));

  // -------- 1. 点击导航平滑滚动 + 高亮 ----------
  navLinks.forEach(link => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const id = this.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      const navHeight = navbar ? navbar.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.pageYOffset - navHeight + 1;

      window.scrollTo({
        top,
        behavior: "smooth"
      });

      // 手动切换 active，避免滚动动画过程中短暂不高亮
      setActiveLink(id);
      // 同步地址栏 hash（不刷新页面）
      history.replaceState(null, "", "#" + id);
    });
  });

  function setActiveLink(id) {
    navLinks.forEach(link => {
      const hrefId = link.getAttribute("href").slice(1);
      if (hrefId === id) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  // -------- 2. 监听滚动，自动更新 active ----------
  if ("IntersectionObserver" in window) {
    const navHeight = navbar ? navbar.offsetHeight : 0;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("id");
            setActiveLink(id);
            history.replaceState(null, "", "#" + id);
          }
        });
      },
      {
        // 让“视口中间附近”的 section 作为当前 section
        root: null,
        threshold: 0.3,
        rootMargin: `-${navHeight + 40}px 0px -50% 0px`
      }
    );

    sections.forEach(sec => observer.observe(sec));
  } else {
    // 兼容旧浏览器的简易方案
    window.addEventListener("scroll", () => {
      const navHeight = navbar ? navbar.offsetHeight : 0;
      const scrollPos = window.pageYOffset + navHeight + 60;

      let currentId = sections[0].id;
      sections.forEach(sec => {
        if (scrollPos >= sec.offsetTop) {
          currentId = sec.id;
        }
      });
      setActiveLink(currentId);
    });
  }

  // -------- 3. 移动端菜单（如果你需要） ----------
  const navToggle = document.getElementById("nav-toggle");
  const navMenu   = document.getElementById("nav-menu");

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      navMenu.classList.toggle("active");
      navToggle.classList.toggle("active");
    });

    // 点击菜单后自动收起
    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("active");
        navToggle.classList.remove("active");
      });
    });
  }
});
