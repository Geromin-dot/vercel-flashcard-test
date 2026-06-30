document.addEventListener('DOMContentLoaded', () => {
    // ===== DOM Elements =====
    const todoInput = document.getElementById('todoInput');
    const todoPriority = document.getElementById('todoPriority');
    const addTodoBtn = document.getElementById('addTodoBtn');
    const todoList = document.getElementById('todoList');
    const clearCompletedBtn = document.getElementById('clearCompletedBtn');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // ===== State =====
    let tasks = loadTasks();
    let currentFilter = 'all';
    let draggedItem = null;

    // ===== LocalStorage Cloud Sync Simulation =====
    function loadTasks() {
        const stored = localStorage.getItem('ifocus_tasks');
        if (stored) {
            return JSON.parse(stored);
        }
        // Default tasks
        return [
            { id: Date.now() - 5, text: 'Write 10-page Research Paper', priority: 'high', category: 'writing', completed: false },
            { id: Date.now() - 4, text: 'Read Chapter 4 & 5 of Biology', priority: 'medium', category: 'study', completed: false },
            { id: Date.now() - 3, text: 'Organize lecture notes for 10 mins', priority: 'low', category: 'review', completed: false },
            { id: Date.now() - 2, text: 'Complete Math Problem Set', priority: 'high', category: 'study', completed: false },
            { id: Date.now() - 1, text: 'Review flashcards on History dates', priority: 'low', category: 'review', completed: false },
        ];
    }

    function saveTasks() {
        localStorage.setItem('ifocus_tasks', JSON.stringify(tasks));
        // Simulate cloud sync visual cue
        const syncBadge = document.querySelector('.sync-badge');
        if (syncBadge) {
            syncBadge.style.color = '#fcd34d';
            syncBadge.querySelector('.dot').style.background = '#fcd34d';
            setTimeout(() => {
                syncBadge.style.color = '';
                syncBadge.querySelector('.dot').style.background = '';
            }, 600);
        }
    }

    // ===== Render Tasks =====
    function renderTasks() {
        todoList.innerHTML = '';
        
        const filtered = tasks.filter(task => {
            if (currentFilter === 'active') return !task.completed;
            if (currentFilter === 'completed') return task.completed;
            return true;
        });

        if (filtered.length === 0) {
            todoList.innerHTML = `
                <div class="empty-state" style="padding: 2rem;">
                    <p>${currentFilter === 'completed' ? 'No completed tasks yet.' : currentFilter === 'active' ? 'All tasks completed!' : 'No tasks yet. Add one above!'}</p>
                </div>
            `;
            return;
        }

        filtered.forEach((task, index) => {
            const item = document.createElement('div');
            item.className = `todo-item priority-${task.priority}${task.completed ? ' completed' : ''}`;
            item.setAttribute('draggable', 'true');
            item.dataset.id = task.id;
            item.style.animationDelay = `${index * 0.05}s`;

            item.innerHTML = `
                <div class="todo-checkbox${task.completed ? ' checked' : ''}" data-id="${task.id}">
                    ${task.completed ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </div>
                <span class="todo-text">${task.text}</span>
                <span class="todo-priority-badge ${task.priority}">${task.priority}</span>
                <button class="todo-delete" data-id="${task.id}" title="Delete task">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;

            // Drag events
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
                // Update task order in state
                const newOrder = [];
                todoList.querySelectorAll('.todo-item').forEach(el => {
                    const task = tasks.find(t => t.id == el.dataset.id);
                    if (task) newOrder.push(task);
                });
                // Keep tasks not currently displayed
                const displayedIds = new Set(newOrder.map(t => t.id));
                tasks.filter(t => !displayedIds.has(t.id)).forEach(t => newOrder.push(t));
                tasks = newOrder;
                saveTasks();
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedItem || draggedItem === item) return;
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    todoList.insertBefore(draggedItem, item);
                } else {
                    todoList.insertBefore(draggedItem, item.nextSibling);
                }
            });

            todoList.appendChild(item);
        });

        // Attach checkbox events
        todoList.querySelectorAll('.todo-checkbox').forEach(cb => {
            cb.addEventListener('click', () => {
                const id = Number(cb.dataset.id);
                const task = tasks.find(t => t.id === id);
                if (task) {
                    task.completed = !task.completed;
                    saveTasks();
                    renderTasks();
                }
            });
        });

        // Attach delete events
        todoList.querySelectorAll('.todo-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.dataset.id);
                tasks = tasks.filter(t => t.id !== id);
                saveTasks();
                renderTasks();
            });
        });
    }

    // ===== Add Task =====
    function addTask() {
        const text = todoInput.value.trim();
        if (!text) return;

        const newTask = {
            id: Date.now(),
            text: text,
            priority: todoPriority.value,
            completed: false,
        };

        tasks.unshift(newTask);
        saveTasks();
        renderTasks();
        todoInput.value = '';
        todoInput.focus();
    }

    addTodoBtn.addEventListener('click', addTask);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // ===== Clear Completed =====
    clearCompletedBtn.addEventListener('click', () => {
        tasks = tasks.filter(t => !t.completed);
        saveTasks();
        renderTasks();
    });

    // ===== Filter =====
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });

    // ===== Initial Render =====
    renderTasks();
});
