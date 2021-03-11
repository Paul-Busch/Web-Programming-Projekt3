const appHost = "http://localhost:3000";

//We use these as global variables to store the drag state
//Better than the setData method, which is somewhat unreliable across browsers
let draggedTaskId = undefined;
let originBoardId = undefined;

function allowDrop(ev) {
  ev.preventDefault();
}

function drag(ev) {
  //save the id of the dragged task, and the board from where it was dragged.
  draggedTaskId = ev.target.id;
  originBoardId = ev.target.parentElement.id.substring(5);
}

function drop(ev, el) {
  ev.preventDefault();
  let taskId = draggedTaskId;
  let orBoardId = originBoardId;

  //reset the drag values, just to make sure we get undefined errors if we ever do something wrong
  //that's easier to find/debug than "random" ids based on the last drag/drop.
  draggedTaskId = undefined;
  originBoardId = undefined;

  let targetBoardId = el.id.substring(5);

  //Don't do any patch if the boards are identical.
  if (targetBoardId !== orBoardId) {
    moveTask(taskId, orBoardId, targetBoardId, el, (el, taskId) => {
      //I'm using my own callback here to append the task to the "right" board.
      el.appendChild(document.getElementById(taskId));
    });
  }  
}

function moveTask(taskId, origin, target, element, callback) {
  let url = appHost + '/api/v1/boards/' + origin + '/tasks/' + taskId;

  //Perform an AJAX PATCH request to the url
  axios.patch(url, { boardId: target })
    .then(function (response) {
      //If patch is successful, just send the element and the task id back, and let the drop callback handle the appending in the DOM.
      callback(element, taskId);
    })
    .catch(function (error) {
      console.log(error);
    });
}

//Helper method to get all boards, nothing fancy.
function requestAllBoards(callback) {
  let url = appHost + '/api/v1/boards';

  axios.get(url)
    .then(function (response) {
      callback(response.data);
    })
    .catch(function (error) {
      callback(null);
    });
}

//Helper method to get all tasks for a board, nothing fancy.
function requestAllTasksForBoard(boardId, callback) {
  let url = appHost + '/api/v1/boards/' + boardId + '/tasks';

  axios.get(url)
    .then(function (response) {
      callback(response.data);
    })
    .catch(function (error) {
      callback(null);
    });
}


//This is run when parsed, so all boards are requested from the backend and drawn.
requestAllBoards((res) => {
  //Add listener to the create board input field
  let inputField = document.getElementById("createBoardField");
  inputField.addEventListener("keyup", function (event) {
    if (event.key === "Enter") {

      //Don't allow empty board names
      if (event.currentTarget.value !== undefined && event.currentTarget.value !== "") {
        //post board first (and wait for succesful response), then draw it.
        let url = appHost + '/api/v1/boards';

        //Perform an AJAX POST request to the url
        axios.post(url, {name: event.currentTarget.value, description: ""})
          .then(function (response) {
            drawBoard(response.data);
          })
          .catch(function (error) {
            console.log("Error");
          });

      }
    }
  });

  //Minor error handling --> Response data has to be an array.
  if (Array.isArray(res)) {
    //For each board, get all tasks and, if tasks are returned, insert them into the board (on the HTML page)
    for (let i = 0; i < res.length; i++) {
      console.log("Current board: " + res[i].name);
      requestAllTasksForBoard(res[i].id, (tasks) => {
        console.log("Tasks: ", tasks);
        insertTasksIntoBoard(tasks);
      });

      //Draw the board. Note that, because requestAllTasksForBoard is asynchronous, this function will execute completely before there is a response from the tasks.
      drawBoard(res[i]);
    }

  } else {
    console.log("Error: ", res);
  }
});

function drawBoard(board) {
  if (typeof (board) === 'object') {
    let container = document.getElementById("boardContainer");

    let col = document.createElement("div");
    let card = document.createElement("div");
    let cardBody = document.createElement("div");
    let header = document.createElement("h5");
    let inputField = document.createElement("input");
    let dismissBtn = document.createElement("button");

    col.className = "col-sm-3";
    card.className = "card";
    cardBody.className = "card-body d-grid gap-2";
    cardBody.id = "board" + board.id;
    cardBody.setAttribute("ondrop", "drop(event, this)");
    cardBody.setAttribute("ondragover", "allowDrop(event)");
    header.className = "card-title";
    header.textContent = board.name;
    dismissBtn.className = "btn-close";
    dismissBtn.type = "button";
    dismissBtn.setAttribute("aria-label", "Close");
    dismissBtn.id = "deleteBoard" + board.id;
    dismissBtn.addEventListener('click', deleteBoard);

    inputField.setAttribute("type", "text");
    inputField.className = "form-control";
    inputField.setAttribute("placeholder", "Create new task");
    inputField.addEventListener("keyup", function (event) {
      if (event.key === "Enter") {

        if (event.currentTarget.value !== undefined && event.currentTarget.value !== "") {
          createTask(event.currentTarget.value, event.currentTarget.parentElement.id.substring(5));
        }
      }
    });

    cardBody.appendChild(dismissBtn);
    cardBody.appendChild(header);
    cardBody.appendChild(inputField);
    card.appendChild(cardBody);
    col.appendChild(card);
    container.appendChild(col);
  }
}

function createTask(taskName, boardId) {
  let url = appHost + '/api/v1/boards/' + boardId + '/tasks';

  //Perform an AJAX POST request to the url
  axios.post(url, { taskName: taskName })
    .then(function (response) {
      insertTasksIntoBoard([response.data]);
    })
    .catch(function (error) {
      console.log(error);
    });
}

function archiveTask(event) {
  let boardId = event.currentTarget.parentElement.parentElement.id.substring(5);

  let url = appHost + '/api/v1/boards/' + boardId + '/tasks/' + event.currentTarget.parentElement.id;

  let card = event.currentTarget.parentElement;

  //Perform an AJAX PATCH request to the url
  axios.patch(url, { archived: true })
    .then(function (response) {
      console.log("Success");
      card.parentElement.removeChild(card);
    })
    .catch(function (error) {
      console.log(error);
    });
}

function deleteBoard (event) {
  let boardId = event.currentTarget.id.substring(11);
  let url = appHost + '/api/v1/boards/' + boardId;

  let col = event.currentTarget.parentElement.parentElement.parentElement;

  //Perform an AJAX DELETE request to the url
  axios.delete(url)
    .then((response) => {
      col.parentElement.removeChild(col);
    })
    .catch(function (error) {
      console.log(error);
    });
}

function insertTasksIntoBoard(tasks) {
  if (Array.isArray(tasks)) {
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].archived !== true && tasks[i].boardId !== -1) {
        let container = document.getElementById("board" + tasks[i].boardId);
        let alert = document.createElement("div");
        let header = document.createElement("strong");
        let dismissBtn = document.createElement("button");

        //todo: Only hide if deletion is successful.
        alert.className = "alert alert-warning alert-dismissible fade show";
        alert.id = tasks[i].id;
        alert.setAttribute("role", "alert");
        alert.setAttribute("draggable", "true");
        alert.setAttribute("ondragstart", "drag(event)");

        header.textContent = tasks[i].taskName;
        dismissBtn.className = "btn-close";
        dismissBtn.type = "button";
        dismissBtn.setAttribute("aria-label", "Close");
        dismissBtn.id = "dismiss" + tasks[i].id;
        dismissBtn.addEventListener('click', archiveTask);

        alert.appendChild(header);
        alert.appendChild(dismissBtn);
        container.appendChild(alert);
      }
    }
  }
}