const input = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const list = document.getElementById('todo-list');
const taskCounter = document.getElementById("task-counter");
const emptyMsg = document.getElementById('empty-msg');
const clearBtn = document.getElementById("clear-btn");


function addTodo() {
    const text = input.value.trim();

    if (text ==='') {
        return;
    }

    const li = document.createElement('li');

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = text;

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'x';
     
    span.addEventListener( 'click', function(){
        li.classList.toggle('done');
        saveTasks();
    });

    deleteBtn.addEventListener('click', function(){
        li.remove();
        checkEmpty();
        updateCounter();
        saveTasks();

    })
    
    li.appendChild(span);
    li.appendChild(deleteBtn);
    list.appendChild(li);

    input.value = '';
    checkEmpty();
    updateCounter();
    saveTasks();

}

function checkEmpty() {
    emptyMsg.style.display = list.children.length === 0 ? 'block': 'none';
}

addBtn.addEventListener('click', addTodo);

clearBtn.addEventListener("click", clearCompleted);

input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        addTodo();
    }
    
})
loadTasks();

function saveTasks() {
    localStorage.setItem("todos", list.innerHTML);
}

function restoreEvents() {

    document.querySelectorAll(".task-text").forEach(function (span) {
        span.addEventListener("click", function () {
    span.parentElement.classList.toggle("done");
    saveTasks();

});



});
document.querySelectorAll("#todo-list button").forEach(function (button) {

    button.addEventListener("click", function () {

    button.parentElement.remove();

    checkEmpty();

    updateCounter();

    saveTasks();

});


    });

}

function loadTasks() {
    const savedTasks = localStorage.getItem("todos");

    if (savedTasks) {
        list.innerHTML = savedTasks;
    }

    restoreEvents();

    checkEmpty();
    updateCounter();
}

function clearCompleted() {

    const completedTasks = document.querySelectorAll("#todo-list li.done");

    completedTasks.forEach(function(task){
        task.remove();
    });

    checkEmpty();
    updateCounter();
    saveTasks();
}

function updateCounter() {
    const count = list.children.length;

    taskCounter.textContent =
        `${count} task${count !== 1 ? "s" : ""} remaining`;
}