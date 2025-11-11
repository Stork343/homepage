// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    // 获取导航相关元素
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');
    
    // 移动端导航菜单切换
    navToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
    
    // 点击导航链接时关闭移动端菜单
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });
    
    // 平滑滚动到指定章节
    function smoothScrollTo(targetId) {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            const navHeight = document.querySelector('.navbar').offsetHeight;
            const targetPosition = targetElement.offsetTop - navHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    }
    
    // 为所有导航链接添加平滑滚动
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            smoothScrollTo(targetId);
            
            // 更新活动状态
            updateActiveNavLink(this);
        });
    });
    
    // 更新活动导航链接
    function updateActiveNavLink(activeLink) {
        navLinks.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }
    
    // 滚动时更新活动导航链接
    function updateNavOnScroll() {
        const navHeight = document.querySelector('.navbar').offsetHeight;
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - navHeight - 100;
            const sectionHeight = section.offsetHeight;
            
            if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    }
    
    // 监听滚动事件
    window.addEventListener('scroll', updateNavOnScroll);
    
    // 为publication-title链接添加平滑滚动（如果有锚点）
    const publicationLinks = document.querySelectorAll('.publication-title a');
    publicationLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // 如果链接是外部链接，不阻止默认行为
            if (this.getAttribute('href').startsWith('http')) {
                return;
            }
            
            // 如果是页面内锚点，实现平滑滚动
            if (this.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                if (targetId) {
                    smoothScrollTo(targetId);
                }
            }
        });
    });
    
    // 键盘导航支持
    document.addEventListener('keydown', function(e) {
        // ESC键关闭移动端菜单
        if (e.key === 'Escape') {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        }
        
        // 方向键导航（可选功能）
        if (e.key === 'ArrowDown' && e.ctrlKey) {
            e.preventDefault();
            const currentIndex = Array.from(navLinks).findIndex(link => link.classList.contains('active'));
            const nextIndex = (currentIndex + 1) % navLinks.length;
            navLinks[nextIndex].focus();
        }
        
        if (e.key === 'ArrowUp' && e.ctrlKey) {
            e.preventDefault();
            const currentIndex = Array.from(navLinks).findIndex(link => link.classList.contains('active'));
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : navLinks.length - 1;
            navLinks[prevIndex].focus();
        }
    });
    
    // 图片加载错误处理
    const profileAvatar = document.querySelector('.profile-avatar');
    if (profileAvatar) {
        profileAvatar.addEventListener('error', function() {
            // 如果图片加载失败，显示默认头像
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjYwIiBjeT0iNjAiIHI9IjUwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA2MEM1MCA0OC4yODgyIDYwLjI4ODIgMzYgNzYgMzZIMTQ0QzE1OS43MTE4IDM2IDE3MCA0OC4yODgyIDE3MCA2MFYzNEMxNzAgMzUuNDQxOCAxNDAuNTU4MiAyNCAxMjAgMjRIMTUwQzEyMC4xNDQ3IDI0IDk5LjU1ODIgMzUuNDQxOCA5MCA0NFY2MFoiIGZpbGw9IiNENEQ1REIiLz4KPGVsbGlwc2UgY3g9IjEwMCIgY3k9IjEwMCIgcng9IjE4IiByeT0iMTQiIGZpbGw9IiNDQkNCQ0QiLz4KPC9zdmc+';
        });
    }
    
    // 添加页面加载动画（可选）
    window.addEventListener('load', function() {
        document.body.classList.add('loaded');
    });
    
    // 主题切换功能（为未来扩展预留）
    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    }
    
    // 保存主题偏好
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    
    // 检测系统主题偏好
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && !savedTheme) {
        document.body.classList.add('dark-theme');
    }
    
    // 监听系统主题变化
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
            if (!localStorage.getItem('theme')) {
                document.body.classList.toggle('dark-theme', e.matches);
            }
        });
    }
    
    // 性能优化：使用节流函数处理滚动事件
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }
    
    // 对滚动处理函数应用节流
    const throttledScrollHandler = throttle(updateNavOnScroll, 16); // 约60fps
    
    // 移除原有的滚动监听，使用节流版本
    window.removeEventListener('scroll', updateNavOnScroll);
    window.addEventListener('scroll', throttledScrollHandler);
    
    // 添加访问性改进
    const focusableElements = document.querySelectorAll(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
    );
    
    // 为所有交互元素添加焦点样式
    focusableElements.forEach(element => {
        element.addEventListener('focus', function() {
            this.classList.add('focused');
        });
        
        element.addEventListener('blur', function() {
            this.classList.remove('focused');
        });
    });
    
    // 为页面添加键盘导航支持
    function handleKeyNavigation(e) {
        const focusableElements = Array.from(document.querySelectorAll('.nav-link, .social-link, .pub-link, .project-link'));
        const currentIndex = focusableElements.indexOf(document.activeElement);
        
        if (e.key === 'Tab') {
            // Tab键导航已由浏览器处理
            return;
        }
        
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (currentIndex + 1) % focusableElements.length;
            focusableElements[nextIndex].focus();
        }
        
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
            focusableElements[prevIndex].focus();
        }
    }
    
    document.addEventListener('keydown', handleKeyNavigation);
    
    // 页面可见性变化处理
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // 页面隐藏时暂停动画
            document.body.classList.add('page-hidden');
        } else {
            // 页面显示时恢复动画
            document.body.classList.remove('page-hidden');
        }
    });
});

// 导出一些全局函数供外部使用
window.AcademicSite = {
    scrollToSection: function(sectionId) {
        const targetElement = document.getElementById(sectionId);
        if (targetElement) {
            const navHeight = document.querySelector('.navbar').offsetHeight;
            const targetPosition = targetElement.offsetTop - navHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    },
    
    updateActiveSection: function(sectionId) {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + sectionId) {
                link.classList.add('active');
            }
        });
    }
};