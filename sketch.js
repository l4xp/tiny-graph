// -------------------------------
//           TinyGraph
//   a basic graph visualizer
// -[v.25.6.27]-----------[ljzh04]-
// > Node creation, deletion,
//   selection, connection
// > Dynamic node id
// > Connection preview
// > Jiggle physics (node repulsion)
// > Hotkey support
// > Toast notification, animation
// -[USAGE]----------------------
// Left Click -- add node
// Right Click -- remove node
// -[TODO]------------------------
// > canvas edge boundary
// > drag to move node
// > camera zoom/pan
// > save / load
// > display: matrix, json
// > edge weight, direction
// > id !== label
// > edge physics
// > fix toggle overlap bug
// -------------------------------
//  CONFIGURATION & STATE
// -------------------------------
const canvasWidth = 800;
const canvasHeight = 600;
const bgColor = 50;

// Hotkeys
let KEY_CONNECT;
let KEY_CANCEL;
let KEY_LABEL;
let KEY_OVERLAP;

// App state
let nodes = [];
let edges = [];
let toasts = [];
let selectedNode = null;
let hoveredNode = null;
let isConnectingNode = false;
let isLabelsAlwaysVisible = false;
let isAllowOverlap = false;

// UI
let canvas;
let connectButton;
let labelButton;
let overlapButton;

// -------------------------------
//  SETUP
// -------------------------------
function setup() {
  KEY_CONNECT = 'c';
  KEY_CANCEL = ESCAPE;
  KEY_LABEL = 'l';
  KEY_OVERLAP = 'o'

  canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.elt.oncontextmenu = () => false;

  connectButton = createButton('Connect Node | OFF');
  connectButton.position(0, canvasHeight + 10);
  connectButton.mousePressed(handleConnectButton);

  labelButton = createButton('Always show labels | OFF');
  labelButton.position(0, canvasHeight + 40);
  labelButton.mousePressed(handleLabelButton);

  overlapButton = createButton('Allow overlap | OFF');
  overlapButton.position(0, canvasHeight + 70);
  overlapButton.mousePressed(handleOverlapButton);
}

// -------------------------------
//  DRAW LOOP
// -------------------------------
function draw() {
  background(bgColor);

  drawEdges();
  updateHoveredNode();
  drawNodes();
  drawConnectionLine();
  drawToasts();
}

function drawEdges() {
  stroke(250);
  for (let [a, b] of edges) {
    line(a.x, a.y, b.x, b.y);
  }
}

function drawNodes() {
  for (let node of nodes) {
    if(isAllowOverlap === true) break;
    node.applyRepulsion(nodes);
  }
  for (let node of nodes) {
    node.update();
    node.show();
  }

  if (hoveredNode) hoveredNode.highlight("hover");
  if (selectedNode) selectedNode.highlight("select");
}

function drawConnectionLine() {
  if (selectedNode && isConnectingNode) {
    stroke(255);
    strokeWeight(2);
    line(selectedNode.x, selectedNode.y, mouseX, mouseY);
  }
}

// -------------------------------
//  INPUT HANDLERS
// -------------------------------
function mousePressed() {
  if (mouseX > canvasWidth || mouseY > canvasHeight) return;

  const indexH = nodes.indexOf(hoveredNode);
  const indexS = nodes.indexOf(selectedNode);

  // Right-click to delete
  if (mouseButton === RIGHT && hoveredNode) {
    nodes.splice(indexH, 1);
    edges = edges.filter(edge => edge[0] !== hoveredNode && edge[1] !== hoveredNode);
    if (indexS === indexH) selectedNode = null;
    updateNodesID();
    return false;
  }

  // Create or connect nodes
  if (!hoveredNode) {
    let newNode = new Node(mouseX, mouseY, "node " + (nodes.length + 1));
    nodes.push(newNode);
    selectedNode = null;
    isConnectingNode = false;
    updateUIState();
  } else if (!isConnectingNode) {
    selectedNode = hoveredNode;
  } else {
    attemptConnection(hoveredNode);
  }
}

function keyPressed() {
  if (keyCode === KEY_CANCEL && isConnectingNode) {
    isConnectingNode = false;
    selectedNode = null;
    updateUIState();
  }

  if (key === KEY_CONNECT && !isConnectingNode) {
    handleConnectButton();
  }

  if (key === KEY_LABEL){
    handleLabelButton();
  }
  if (key === KEY_OVERLAP){
    handleOverlapButton();
  }
  if (key === 'z') {
    console.log(JSON.stringify({
      nodes: nodes.map(n => ({ x: n.x, y: n.y, id: n.id })),
      edges: edges.map(([a, b]) => [a.id, b.id])
    }, null, 2));
  }
}

// -------------------------------
//  LOGIC
// -------------------------------
function updateHoveredNode() {
  hoveredNode = null;
  for (let node of nodes) {
    if (node.isHovered()) {
      hoveredNode = node;
      break;
    }
  }
}
function updateNodesID(){
  for (let i = 0; i < nodes.length; i++){
    nodes[i].id = "node "+ (i+1);
  }
}
function handleConnectButton() {
  if (!selectedNode) {
    createToast("Please select a starting node first.");
    return;
  }

  isConnectingNode = !isConnectingNode;
  updateUIState();
}

function handleLabelButton() {
  isLabelsAlwaysVisible = !isLabelsAlwaysVisible;
  for(let node of nodes){
    node.labelVisible = isLabelsAlwaysVisible;
  }
  updateUIState();
}
function handleOverlapButton(){
  isAllowOverlap = !isAllowOverlap;
  updateUIState();
}
function attemptConnection(targetNode) {
  if (!selectedNode || !targetNode || selectedNode === targetNode) return;

  let exists = edges.some(
    ([a, b]) =>
      (a === selectedNode && b === targetNode) ||
      (a === targetNode && b === selectedNode)
  );

  if (!exists) {
    edges.push([selectedNode, targetNode]);
    createToast(`Connected ${selectedNode.id} → ${targetNode.id}`);
  } else {
    createToast("These nodes are already connected.");
  }

  isConnectingNode = false;
  selectedNode = null;
  updateUIState();
}

// -------------------------------
//  UI HELPERS
// -------------------------------
function updateUIState() {
  connectButton.html("Connect Node | " + (isConnectingNode ? "ON" : "OFF"));
  labelButton.html("Always show labels | " + (isLabelsAlwaysVisible ? "ON" : "OFF"));
  overlapButton.html("Allow overlap | " + (isAllowOverlap ? "ON" : "OFF"));
}

function createToast(message, duration = 3000) {
  toasts.push({
    message,
    createdAt: millis(),
    duration,
  });
}

function drawToasts() {
  let now = millis();
  let y = 20;

  for (let i = toasts.length - 1; i >= 0; i--) {
    let toast = toasts[i];
    let elapsed = now - toast.createdAt;

    if (elapsed > toast.duration) {
      toasts.splice(i, 1);
      continue;
    }

    let alpha = map(elapsed, toast.duration - 800, toast.duration, 255, 0);
    alpha = constrain(alpha, 0, 255);

    fill(255, 255, 255, alpha);
    stroke(0, alpha);
    rect(20, y, 300, 30, 5);

    fill(0, alpha);
    noStroke();
    textAlign(LEFT, CENTER);
    text(toast.message, 30, y + 15);

    y += 40;
  }
}

// -------------------------------
//  CLASSES
// -------------------------------
class Node {
  constructor(x, y, id = "") {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = 20;
    this.id = id;

    this.tx = x;
    this.ty = y;
    this.speed = 0.1;

    this.labelVisible = isLabelsAlwaysVisible;

  }

  update(){
    let dx = this.tx - this.x;
    let dy = this.ty - this.y;
    this.vx += dx * 0.01;
    this.vy += dy * 0.01;
    this.x += this.vx;
    this.y += this.vy;

  }

  moveTo(x,y){
    this.tx = x;
    this.ty = y;
  }
  applyRepulsion(others){
    let fx = 0;
    let fy = 0;
    for (let other of others){
      if (other === this) continue;

      let dx = this.x - other.x;
      let dy = this.y - other.y;
      let d = sqrt(dx * dx + dy * dy);

      if (d < this.r * 2 && d > 0.1){
        let overlap = this.r * 2 - d;
        let force = overlap * 0.5;

        dx /= d;
        dy /= d;

        fx += dx * force;
        fy += dy * force;
      }
    }

    this.vx = (this.vx + fx) * 0.5;
    this.vy = (this.vy + fy) * 0.5

    this.vx = constrain(this.vx, -5, 5);
    this.vy = constrain(this.vy, -5, 5);
  }
  isHovered() {
    return dist(this.x, this.y, mouseX, mouseY) < this.r;
  }

  show() {
    fill(255);
    stroke(0);
    ellipse(this.x, this.y, this.r * 2);

    if (this.labelVisible) this.drawLabel();
  }

  drawLabel() {
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    text(this.id, this.x, this.y + this.r + 7);
  }

  highlight(type) {
    if (type === "remove") {
      fill(255, 0, 0);
      stroke(0);
      ellipse(this.x, this.y, this.r * 2);
    }

    if (type === "hover") {
      noFill();
      stroke(120);
      ellipse(this.x, this.y, this.r * 2 + 7);
      this.drawLabel();
    }

    if (type === "select") {
      noFill();
      stroke(255);
      ellipse(this.x, this.y, this.r * 2 + 7);
      this.drawLabel();
    }
  }
}
