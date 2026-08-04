const input = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const list = document.getElementById('todo-list');
const emptyMsg = document.getElementById('empty-msg');

function addTool() {
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
    });

    deleteBtn.addEventListener('click', function(){
        li.remove();
        checkEmpty();

    })
    
    li.appendChild(span);
    li.appendChild(deleteBtn);
    list.appendChild(li);

    input.value = '';
    checkEmpty();

}

function checkEmpty() {
    emptyMsg.style.display = list.children.length === 0 ? 'block': 'none';
}

addBtn.addEventListener('click', addTool);

input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        addTodo();
    }
    
})
checkEmpty();