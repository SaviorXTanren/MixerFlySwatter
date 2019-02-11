var userID = null;
var participantID = null;

var allFliesDiv;
var scoreBoxText;
var timeLeftText;
var winnerDiv;
var gameInProgressDiv;

var winnerImage;
var winnerText;

var allFliesMap = new Map();

var timeLeft;

var mainWidth = 0;
var mainHeight = 0;

var flyWidth = 50;
var flyHeight = 50;

var totalFliesSpawned = 0;
var totalFliesSwatted = 0;

var xMouseCoordinate = 0;
var yMouseCoordinate = 0;

// Gamepad API code from: https://github.com/luser/gamepadtest

var gamepadSelectorDiv;

const XboxControllerID = "Xbox 360 Controller (XInput STANDARD GAMEPAD)";
const AButtonID = 0;
const XButtonID = 2;
const LeftTriggerID = 6;
const RightTriggerID = 7;
const LeftStickXAxis = 0;
const LeftStickYAxis = 1;

var xGamepadCoordinate = 0;
var yGamepadCoordinate = 0;

var haveGamepadEvents = 'GamepadEvent' in window;
var haveWebkitEvents = 'WebKitGamepadEvent' in window;
var controllers = {};
var previousButtons = {};

var rAF = window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.requestAnimationFrame;

// Game logic methods

function gameStart(totalTime) {
	totalFliesSpawned = 0;
	totalFliesSwatted = 0;
	
	winnerDiv.style.visibility = 'hidden';
	gameInProgressDiv.style.visibility = 'hidden';
	
	clearFlies();
	
	scoreBoxText.innerHTML = "Total: " + totalFliesSwatted;
	timeLeftText.innerHTML = "Time: " + totalTime;
	
	gameLoop();
}

function gameLoop() {
	setTimeout(function () {		
		if (timeLeft > 0) {
			addFly();
			
			gameLoop();
		}
	}, 500);
}

function clearFlies() {
	while (allFliesDiv.firstChild) {
		allFliesDiv.removeChild(allFliesDiv.firstChild);
	}
	allFliesMap.clear();
}

function addFly() {
	totalFliesSpawned++;
	
	var xPos = 0;
	var yPos = 0;
	var xDirection = 0;
	var yDirection = 0;
	
	var spawnLocation = Math.round(Math.random() * 400) % 4;
	if (spawnLocation == 0) {		// Top
		xPos = Math.round(Math.random() * 100);
	}
	else if (spawnLocation == 1) {	// Right
		xPos = 100;
		yPos = Math.round(Math.random() * 100);
	}
	else if (spawnLocation == 2) {	// Bottom
		xPos = Math.round(Math.random() * 100);
		yPos = 100;
	}
	else if (spawnLocation == 3) {	// Left
		yPos = Math.round(Math.random() * 100);
	}
	
	if (xPos < 50) {
		xDirection = 1;
	}
	else {
		xDirection = -1;
	}
	
	if (yPos < 50) {
		yDirection = 1;
	}
	else {
		yDirection = -1;
	}
	
	var flyImage = document.createElement('img');
	flyImage.id = "flyImage" + totalFliesSpawned;
	flyImage.src = "fly.png";
	
	flyImage.className = "flyImage";
	if (xDirection == -1) {
		flyImage.className += " flyImageReversed";
	}
	
	flyImage.style.left = xPos + '%';
	flyImage.style.top = yPos + '%';
	
	var fly = { id: flyImage.id, image: flyImage, x: xPos, y: yPos, xDirection: xDirection, yDirection: yDirection };

	allFliesMap.set(flyImage.id, fly);

	allFliesDiv.appendChild(flyImage);
	
	$(fly).click(function () {
        flySwatted(fly);
    });
	
	moveFly(fly);
}

function moveFly(fly) {
	if (allFliesMap.has(fly.id)) {
		setTimeout(function () {
			
			fly.x = fly.x + (fly.xDirection * 0.10);
			fly.y = fly.y + (fly.yDirection * 0.10);
			
			fly.image.style.left = fly.x + '%';
			fly.image.style.top = fly.y + '%';
			
			if (-5 < fly.x && fly.x < 105 && -5 < fly.y && fly.y < 105) {
				moveFly(fly);
			}
			else {
				removeFly(fly);
			}
		}, 10);	
	}
}

function allFliesDivClicked(x, y) {
	for (var [key, fly] of allFliesMap) {
		
		var flyX = parseInt($(fly.image).css('left'), 10);
		var flyY = parseInt($(fly.image).css('top'), 10);
		if (fly.xDirection == -1) {
			flyX = flyX + flyWidth;
			flyY = flyY + flyHeight;
		}
		
		flyX = flyX - (flyWidth / 2);
		flyY = flyY - (flyHeight / 2);
		
		if (flyX <= x && x <= (flyX + flyWidth) && flyY <= y && y <= (flyY + flyHeight)) {
			
			removeFly(fly);
			
			totalFliesSwatted++;
			
			scoreBoxText.innerHTML = "Total: " + totalFliesSwatted;
			
			mixer.socket.call('giveInput', {
				controlID: 'flyHit',
				event: 'mousedown',
				meta: {
					total: totalFliesSwatted,
				}
			});

			return;
		}
	}
}

function removeFly(fly) {
	allFliesMap.delete(fly.id);
	allFliesDiv.removeChild(fly.image);
}

// Gamepad methods

function connecthandler(e) {
    addgamepad(e.gamepad);
}
function addgamepad(gamepad) {
    controllers[gamepad.index] = gamepad;
    rAF(updateStatus);
}

function disconnecthandler(e) {
    removegamepad(e.gamepad);
}

function removegamepad(gamepad) {
    var d = document.getElementById("controller" + gamepad.index);
    document.body.removeChild(d);
    delete controllers[gamepad.index];
}

function updateStatus() {
    scangamepads();
    for (j in controllers) {
        gamepadSelectorDiv.style.visibility = 'visible';

        var controller = controllers[j];
        if (controller.id == XboxControllerID) {

            if (controller.axes.length >= LeftStickYAxis) {
                xMovement = parseFloat(controller.axes[LeftStickXAxis].toFixed(2));
                yMovement = parseFloat(controller.axes[LeftStickYAxis].toFixed(2));

                if (xMovement != NaN && (xMovement > 0.05 || xMovement < -0.05) && yMovement != NaN && (yMovement > 0.05 || yMovement < -0.05)) {
                    xGamepadCoordinate += xMovement * 5.0;
                    yGamepadCoordinate += yMovement * 5.0;

                    xGamepadCoordinate = clamp(xGamepadCoordinate, 0, mainWidth);
                    yGamepadCoordinate = clamp(yGamepadCoordinate, 0, mainHeight);

                    if (gamepadSelectorDiv != null) {
                        gamepadSelectorDiv.style.left = xGamepadCoordinate + "px";
                        gamepadSelectorDiv.style.top = yGamepadCoordinate + "px";
                    }
                }
            }

            if (isButtonPressed(controller, AButtonID) || isButtonPressed(controller, XButtonID) ||
                isButtonPressed(controller, LeftTriggerID) || isButtonPressed(controller, RightTriggerID)) {
					
                allFliesDivClicked(xGamepadCoordinate, yGamepadCoordinate);
            }

            break;
        }
    }

    rAF(updateStatus);
}

function scangamepads() {
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    for (var i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            if (!(gamepads[i].index in controllers)) {
                addgamepad(gamepads[i]);
            } else {
                controllers[gamepads[i].index] = gamepads[i];
            }
        }
    }
}

function isButtonPressed(controller, index) {
    var pressed = false;
    if (controller.buttons.length >= index) {
        var value = controller.buttons[index];
        var active = value == 1.0;
        if (typeof (value) == "object") {
            active = value.pressed;
        }

        pressed = !previousButtons[index] && active;

        previousButtons[index] = active;
    }
    return pressed;
}

function clamp(number, min, max) {
    return Math.min(Math.max(number, min), max);
}

// Mixer event methods

function handleParticipantJoined(participants) {
    if (userID == null && participantID == null && participants.participants.length > 0) {
        var participant = participants.participants[0];
		userID = participant.userID;
		participantID = participant.sessionID;
    }
}

function handleControlUpdate(update) {
    if (update.controls.length > 0) {
        var control = update.controls[0];
		
		if (control.controlID === 'gameStart' && control.meta.timeLeft != null) {
			
			gameStart(control.meta.timeLeft);
			
		}
		else if (control.controlID === 'timeLeft' && control.meta.timeLeft != null) {
			timeLeft = control.meta.timeLeft;
			
			if (timeLeft > 0) {
				timeLeftText.innerHTML = "Time: " + timeLeft;
			}
			else {
				timeLeftText.innerHTML = "Time: 0";
				
				clearFlies();
				
				if (totalFliesSwatted > 0) {
					mixer.socket.call('giveInput', {
						controlID: 'gameEnd',
						event: 'mousedown',
						meta: {
							total: totalFliesSwatted,
						}
					});	
				}
			}
		}
		else if (control.controlID === 'results' && control.meta.winner != null) {
			
			gameInProgressDiv.style.visibility = 'hidden';
			
			winnerImage.src = "https://mixer.com/api/v1/users/" + control.meta.winner.userID + "/avatar"
			winnerText.innerHTML = control.meta.winner.username;
			winnerDiv.style.visibility = 'visible';
		}
    }
}

function handleVideoResized(position) {
	mainWidth = parseInt($(allFliesDiv).css('width'), 10);
	mainHeight = parseInt($(allFliesDiv).css('height'), 10);
	
    //const player = position.connectedPlayer;
    //allFlies.style.top = `${player.top}px`;
    //allFlies.style.left = `${player.left}px`;
    //allFlies.style.height = `${player.height}px`;
    //allFlies.style.width = `${player.width}px`;
}

window.addEventListener('load', function initMixer() {
	allFliesDiv = document.getElementById('allFliesDiv');
	scoreBoxText = document.getElementById('scoreBoxText');
	timeLeftText = document.getElementById('timeLeftText');
	winnerDiv = document.getElementById('winnerDiv');
	winnerImage = document.getElementById('winnerImage');
	winnerText = document.getElementById('winnerText');
	gameInProgressDiv = document.getElementById('gameInProgressDiv');
	
	mainWidth = parseInt($(allFliesDiv).css('width'), 10);
	mainHeight = parseInt($(allFliesDiv).css('height'), 10);
	
	xGamepadCoordinate = mainWidth / 2;
	yGamepadCoordinate = mainHeight / 2;
	
	gamepadSelectorDiv = document.getElementById('gamepadSelectorDiv');
    gamepadSelectorDiv.style.left = xGamepadCoordinate + "px";
    gamepadSelectorDiv.style.top = yGamepadCoordinate + "px";
	
	document.body.onmousedown = function() { return false; }
	
	$(allFliesDiv).mousemove(function (event) {
        xMouseCoordinate = event.pageX;
        yMouseCoordinate = event.pageY;
    }).mouseleave(function () {
        xMouseCoordinate = 0;
        yMouseCoordinate = 0;
    }).click(function () {
        allFliesDivClicked(xMouseCoordinate, yMouseCoordinate);
    });
	
	mixer.display.position().subscribe(handleVideoResized);
	
	mixer.socket.on('onParticipantJoin', handleParticipantJoined);
	mixer.socket.on('onControlUpdate', handleControlUpdate);

	mixer.isLoaded();
});

if (haveGamepadEvents) {
    window.addEventListener("gamepadconnected", connecthandler);
    window.addEventListener("gamepaddisconnected", disconnecthandler);
} else if (haveWebkitEvents) {
    window.addEventListener("webkitgamepadconnected", connecthandler);
    window.addEventListener("webkitgamepaddisconnected", disconnecthandler);
} else {
    setInterval(scangamepads, 500);
}
