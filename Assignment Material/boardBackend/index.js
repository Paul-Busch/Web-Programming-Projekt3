//Sample for Assignment 3
const express = require('express');

//Import a body parser module to be able to access the request body as json
const bodyParser = require('body-parser');

//Use cors to avoid issues with testing on localhost
const cors = require('cors');

const app = express();

//Port environment variable already set up to run on Heroku
var port = process.env.PORT || 3000;

//API prefix
const API_PREFIX = '/api/v1';

//Tell express to use the body parser module
app.use(bodyParser.json());

//Tell express to use cors -- enables CORS for this backend
app.use(cors());

//The following is an example of an array of three boards. 
var boards = [
    { id: '0', name: "Planned", description: "Everything that's on the todo list.", tasks: ["0", "1", "2"] },
    { id: '1', name: "Ongoing", description: "Currently in progress.", tasks: [] },
    { id: '3', name: "Done", description: "Completed tasks.", tasks: ["3"] }
];

var tasks = [
    { id: '0', boardId: '0', taskName: "Another task", dateCreated: new Date(Date.UTC(2021, 00, 21, 15, 48)), archived: false },
    { id: '1', boardId: '0', taskName: "Prepare exam draft", dateCreated: new Date(Date.UTC(2021, 00, 21, 16, 48)), archived: false },
    { id: '2', boardId: '0', taskName: "Discuss exam organisation", dateCreated: new Date(Date.UTC(2021, 00, 21, 14, 48)), archived: false },
    { id: '3', boardId: '3', taskName: "Prepare assignment 2", dateCreated: new Date(Date.UTC(2021, 00, 10, 16, 00)), archived: true }
];

//Your endpoints go here

// Board endpoints

// Get all boards
app.get(API_PREFIX + '/boards', (req, res) => {
    let trimmedBoards = [];
    for (const board of boards) {
        trimmedBoards.push({ "id": board.id, "name": board.name, "description": board.description });
    }
    return res.status(200).json(trimmedBoards);
})

// Get all attributes of board with boardId
app.get(API_PREFIX + '/boards/:boardId', (req, res) => {
    var boardId = req.params.boardId;
    var board = getBoard(boardId);

    if (isNaN(boardId)) {
        return res.status(400).json({ "message": "Id not a number!" });
    }

    if (board) {
        return res.status(200).json(board);
    }

    return res.status(404).json({ "message": "Id does not exist!" });
});

// Create a new board with auto generated id
app.post(API_PREFIX + '/boards', function (req, res) {
    var id = getNextBoardId();
    var name = req.body["name"];
    var description = req.body["description"];

    if (!name && name != 0) {
        return res.status(400).json({ "Error": "Missing or empty parameter 'name' in request body." });
    }

    if (description === undefined) {
        return res.status(400).json({ "Error": "Missing parameter 'description' in request body." });
    }

    boards.push({ "id": id, "name": name, "description": description, tasks: [] });

    return res.status(201).json(getBoard(id));
});

// Update a board with given name or description
app.put(API_PREFIX + '/boards/:boardId', (req, res) => {
    var boardId = req.params.boardId;
    var name = req.body["name"];
    var description = req.body["description"];

    if (isNaN(boardId)) {
        return res.status(400).json({ "message": "Id not a number!" });
    }

    if (!name && name != 0) {
        return res.status(400).json({ "Error": "Missing or empty parameter 'name' in request body." });
    }

    if (description === undefined) {
        return res.status(400).json({ "Error": "Missing parameter 'description' in request body." });
    }

    var tasksInBoard = getAllTasks(boardId);

    for (const task of tasksInBoard) {
        if (task.archived == false) {
            return res.status(400).json({ "message": "Not all tasks in this board are archived!" });
        }
    }

    var board = getBoard(boardId);

    if (board) {
        board.name = name;
        board.description = description;
        boards[findIndexByProperty(boards, "id", boardId)] = board;
        return res.status(200).json(board);
    }

    return res.status(404).json({ "message": "Id does not exist!" });
});

// Delete board with given id if there are no unarchived tasks on that board
app.delete(API_PREFIX + '/boards/:boardId', (req, res) => {
    var boardId = req.params.boardId;

    if (isNaN(boardId)) {
        return res.status(400).json({ "message": "Id not a number!" });
    }

    var board = getBoard(boardId);
    var tasksInBoard = getAllTasks(boardId);

    for (const task of tasksInBoard) {
        if (task.archived == false) {
            return res.status(400).json({ "message": "Not all tasks in this board are archived!" });
        }
    }

    return res.status(200).json(board);
});

// Delete all boards whether the tasks on them are archived or not
app.delete(API_PREFIX + '/boards', (req, res) => {
    var output = [];

    for (const board of boards) {
        var tasks = getAllTasks(board.id);
        output.push({ "id": board.id, "name": board.name, "description": board.description, tasks: tasks })
    }

    boards = [];
    tasks = [];

    return res.status(200).json(output);
});

// Task Endpoints

// Get all tasks in board with boardId
app.get(API_PREFIX + '/boards/:boardId/tasks', (req, res) => {
    var sortBy = req.query.sort;
    var boardId = req.params.boardId;

    if (isNaN(boardId)) {
        return res.status(400).json({ "message": "Id not a number!" });
    }

    var board = getBoard(boardId);

    if (board) {
        var tasksInBoard = getAllTasks(boardId);

        // sorting by id, taskName, dateCreated
        switch (sortBy) {
            case "id":
                tasksInBoard.sort(sortById);
                break;
            case "taskName":
                tasksInBoard.sort(sortByTaskName);
                break;
            case "dateCreated":
                tasksInBoard.sort(sortByDateCreated);
                break;
            default:
                tasksInBoard.sort(sortById);
        }

        return res.status(200).json(tasksInBoard);
    }

    return res.status(404).json({ "message": "Id does not exist!" });
});

// Get all attributes of a task with taskId on board with boardId
app.get(API_PREFIX + '/boards/:boardId/tasks/:taskId', (req, res) => {
    var boardId = req.params.boardId;
    var taskId = req.params.taskId;

    if (isNaN(taskId)) {
        return res.status(400).json({ "message": "Given task id is not a number!" });
    }
    if (isNaN(boardId)) {
        return res.status(400).json({ "message": "Given board id is not a number!" });
    }

    var task = getTask(taskId);
    if (task) {
        if (task.boardId != boardId) {
            return res.status(400).json({ "message": "Given board id does not match given task id!" });
        }
        return res.status(200).json(task);
    }

    return res.status(404).json({ "message": "Id does not exist!" });
});

// Create a new task with auto generated id in board with given boardId 
app.post(API_PREFIX + '/boards/:boardId/tasks', function (req, res) {
    var id = getNextTaskId();
    var boardId = req.params.boardId;
    var taskName = req.body["taskName"];
    var dateCreated = new Date();

    if (!taskName && taskName != 0) {
        return res.status(400).json({ "Error": "Missing or empty parameter 'taskName' in request body." });
    }

    tasks.push({ "id": id, "boardId": boardId, "taskName": taskName, "dateCreated": dateCreated, "archived": false });

    //Adding id of task to task array of board
    var board = getBoard(boardId);
    board.tasks.push(id);
    boards[findIndexByProperty(boards, "id", boardId)] = board;

    return res.status(201).json(getTask(id));
});

// Delete task with given id
app.delete(API_PREFIX + '/boards/:boardId/tasks/:taskId', (req, res) => {
    var boardId = req.params.boardId;
    var taskId = req.params.taskId;

    if (isNaN(taskId)) {
        return res.status(400).json({ "message": "Given task id is not a number!" });
    }
    if (isNaN(boardId)) {
        return res.status(400).json({ "message": "Given board id is not a number!" });
    }

    var task = getTask(taskId);
    if (task) {
        if (task.boardId != boardId) {
            return res.status(400).json({ "message": "Given board id does not match given task id!" });
        }
        //Remove task from tasks array
        tasks.splice(findIndexByProperty(tasks, "id", taskId), 1);

        //Removing id of task from task array of board
        var board = getBoard(boardId);
        board.tasks.splice(board.tasks.indexOf(taskId), 1);
        boards[findIndexByProperty(boards, "id", boardId)] = board;

        return res.status(200).json(task);
    }

    return res.status(404).json({ "message": "Id does not exist!" });
});

// Partially update a task with given id
app.patch(API_PREFIX + '/boards/:boardId/tasks/:taskId', (req, res) => {
    var taskId = req.params.taskId;
    var boardId = req.params.boardId;
    var newBoardId = req.body["boardId"];
    var taskName = req.body["taskName"];
    var archived = req.body["archived"];

    if (isNaN(taskId)) {
        return res.status(400).json({ "message": "Given task id is not a number!" });
    }

    if (isNaN(boardId)) {
        return res.status(400).json({ "message": "Given board id is not a number!" });
    }

    var task = getTask(taskId);
    if (task) {
        if (task.boardId != boardId) {
            return res.status(400).json({ "message": "Given board id does not match given task id!" });
        }

        if (newBoardId != null) {
            if (findIndexByProperty(boards, "id", newBoardId) == -1) {
                return res.status(200).json({ "message": "Target board id is not existing!" });
            }

            //Removing id of task from task array of old board
            var board = getBoard(boardId);
            board.tasks.splice(board.tasks.indexOf(taskId), 1);
            boards[findIndexByProperty(boards, "id", boardId)] = board;

            //Adding id of task to task array of target board
            var targetBoard = getBoard(newBoardId);
            targetBoard.tasks.push(taskId);
            boards[findIndexByProperty(boards, "id", newBoardId)] = targetBoard;

            task.boardId = newBoardId;
        }

        if (taskName != null) {
            task.taskName = taskName;
        }

        if (archived != null) {
            if (typeof archived != "boolean") {
                return res.status(400).json({ "message": "Value for 'archived' is not a boolean!" });
            }

            task.archived = archived;
        }

        return res.status(200).json(task);
    }

    return res.status(404).json({ "message": "Id of task does not exist!" });
});

// Wildcard route that catches all unsupported HTTP verbs and not existing endpoints
app.all('*', (req, res) => {
    res.status(405).json({ "message": "Unsupported HTTP verb or not existing endpoint called!" });
});

// Helper functions

//Gets the next board id
function getNextBoardId() {
    return String(Math.max(...boards.map(boards => boards.id), 0) + 1);
}

//Gets the next task id
function getNextTaskId() {
    return String(Math.max(...tasks.map(tasks => tasks.id), 0) + 1);
}

//Finds a board with given id. Returns undefined if no board matches
function getBoard(boardId) {
    for (const board of boards) {
        if (board.id === boardId) {
            return board;
        }
    }
    return undefined;
}

//Returns task with given taskId
function getTask(taskId) {
    for (const task of tasks) {
        if (task.id === taskId) {
            return task;
        }
    }
    return undefined;
}

//Returns all tasks with given boardId
function getAllTasks(boardId) {
    var tasksInBoard = [];
    for (const task of tasks) {
        if (task.boardId === boardId) {
            tasksInBoard.push(task)
        }
    }

    return tasksInBoard;
}

// Generic sorting helper function sorting by id
// Uses natural order of integers
function sortById(x, y) {
    return x.id - y.id;
}

// Generic sorting helper function sorting by taskName
// Uses natural order of strings
function sortByTaskName(x, y) {
    return x.taskName.localeCompare(y.taskName);
}

// Generic sorting helper function sorting by dateCreated
// Uses natural order of dates
function sortByDateCreated(x, y) {
    return x.dateCreated - y.dateCreated;
}

// Generic helper function that returns index of item matching attribute
// based on 
function findIndexByProperty(data, key, value) {
    for (var i = 0; i < data.length; i++) {
        if (data[i][key] == value) {
            return i;
        }
    }
    return -1;
}

//Start the server
app.listen(port, () => {
    console.log('Event app listening...');
});