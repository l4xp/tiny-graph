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
// -[v.25.6.28]-----------[ljzh04]-
// > fix:
//   no longer add node on right click
//   decouple repulsion and friction (overlap bug)
// > Responsive canvas
// > Canvas edge boundary
// > Drag to move node
// > Improved hotkeys
// > Camera zoom/pan/reset
// > Huge Reorganization
// > Save/load/undo/redo
// > id !== label
// > node preview
// > help text
// -[USAGE]----------------------
// Left Click   -- add node
// Right Click  -- remove node
// Drag         -- move node
// Space + Drag -- pan camera
// Scroll up    -- zoom out
// Scroll down  -- zoom in
// -[TODO]------------------------
// > display: adjacecy list, adjacency matrix, edge list, incidence matrix, obj
// > undirected | directed mode
// > weighted | unweighted mode
// > tree | graph mode
// > traversal visualizer
// > path visualizer (nearest, farthest, pt to pt)
// > interactive node property inspector
// > disable physics mode

// -------------------------------
//  GLOBALS & CONSTANTS
// -------------------------------
// -- Configuration --
const BG_COLOR = 50;
const MAX_ZOOM = 5;
const MIN_ZOOM = 0.2;
const HISTORY_LIMIT = 50;

// -- Application State --
let nodes = [];
let edges = [];
let toasts = [];
let undoStack = [];
let redoStack = [];
let worldBounds = {left:0,right:0,top:0,bottom:0};

let selectedNode = null;
let hoveredNode = null;
let draggedNode = null;

let isConnectingNode = false;
let isLabelsAlwaysVisible = false;
let isAllowOverlap = false;
let isBoundaryStatic = false;
let isDrawPreview = true;

// -- Camera State --
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let canvasX = 0;
let canvasY = 0;

// -- UI Elements --
let canvas;
let connectButton;
let labelButton;
let overlapButton;
let zoomSlider;
let boundaryButton;
let loadButton;
let saveButton;
let previewButton;

// -- Hotkey System --
let hotkeys = {};
const KEY_NAME_MAP = {
  13: 'enter',
  27: 'escape',
  32: 'space',
  37: 'arrowleft',
  38: 'arrowup',
  39: 'arrowright',
  40: 'arrowdown',
  33: 'pageup',
  34: 'pagedown',
  35: 'end',
  36: 'home',
  9:  'tab',
  8:  'backspace',
  46: 'delete',
};
const KEY_CODE_MAP = {};
for (const code in KEY_NAME_MAP) {
  const name = KEY_NAME_MAP[code];
  KEY_CODE_MAP[name] = Number(code);
}

// -- Help UI --
const HELP_TEXT = [
  { category: 'Mouse Controls', items: [
    { key: 'Left Click', desc: 'Add Node' },
    { key: 'Right Click', desc: 'Delete Node' },
    { key: 'Drag Node', desc: 'Move Node' },
    { key: 'Space + Drag', desc: 'Pan Camera' },
    { key: 'Mouse Wheel', desc: 'Zoom Camera' },
  ]},
  { category: 'Hotkeys', items: [
    { key: 'C', desc: 'Toggle Connect Mode' },
    { key: 'L', desc: 'Toggle Node Labels' },
    { key: 'O', desc: 'Toggle Node Overlap' },
    { key: 'Home', desc: 'Reset Camera' },
    { key: 'Ctrl + Z', desc: 'Undo' },
    { key: 'Ctrl + Y', desc: 'Redo' },
  ]},
];
// -------------------------------
//  P5.js MAIN
// -------------------------------
function setup() {
  saveState();
  canvas = createCanvas(windowWidth,  windowHeight * 3/4);
  canvas.elt.oncontextmenu = () => false;

  // Initialize UI elements
  connectButton = createButton('Connect Node | OFF');
  labelButton = createButton('Always show labels | OFF');
  overlapButton = createButton('Allow overlap | OFF');
  zoomSlider = createSlider(MIN_ZOOM, MAX_ZOOM, 1, 0.1);
  boundaryButton = createButton('Static boundary | OFF');
  saveButton = createButton('Export Graph');
  previewButton = createButton('Add node preview | OFF');
  updateUIState();

  // Attach event handlers to UI
  connectButton.mousePressed(handleConnectButton);
  labelButton.mousePressed(handleLabelButton);
  overlapButton.mousePressed(handleOverlapButton);
  zoomSlider.input(handleZoom);
  boundaryButton.mousePressed(handleBoundaryButton);
  saveButton.mousePressed(saveGraph);
  loadButton = createFileInput(handleFileLoad);
  previewButton.mousePressed(handlePreviewButton);

  // Register hotkeys
  regHotkey('escape', connectModeOff);
  regHotkey('c', connectModeOn);
  regHotkey('l', handleLabelButton);
  regHotkey('o', handleOverlapButton);
  regHotkey('pageup', zoomIn);
  regHotkey('pagedown', zoomOut);
  regHotkey('home', home);
  regHotkey('ctrl+z', undo);
  regHotkey('ctrl+y', redo);

  // Initial positioning
  positionUI();
}
function draw() {
  background(BG_COLOR);

  // --- Per-frame updates ---
  getCanvasMousePos();
  updateWorldBounds();
  updateHoveredNode();

  // --- Drawing ---
  push(); // Start camera view
  translate(offsetX, offsetY);
  scale(zoom);

  drawWorld();

  pop(); // End camera view

  drawUI();
}
// -------------------------------
//  CORE DRAWING & UPDATE LOOPS
// -------------------------------
function drawWorld() {
  drawEdges();
  drawNodes();
  drawNodePreview();
  drawConnectionLine();
}
function drawUI() {
  drawToasts();
  drawHelpPanel();
}
function drawEdges() {
  stroke(250);
  for (let [a, b] of edges) {
    line(a.x, a.y, b.x, b.y);
  }
}
function drawNodes() {
  for (let node of nodes) {
    if(isAllowOverlap === false)
      node.applyRepulsion(nodes);
    node.applyBoundary();
  }
  for (let node of nodes) {
    node.update();
    node.show();
  }

  if (hoveredNode) hoveredNode.highlight("hover");
  if (selectedNode) selectedNode.highlight("select");
  if (draggedNode) draggedNode.highlight("drag");
}
function drawNodePreview(){
  let world = screenToWorld(mouseX,mouseY);
  if(isDrawPreview && !hoveredNode){
    noFill();
    stroke(120);
    ellipse(world.x, world.y, 20 * 2);
  }
}
function drawConnectionLine() {
  if (selectedNode && isConnectingNode) {
    stroke(255);
    strokeWeight(2);
    line(selectedNode.x, selectedNode.y, canvasX, canvasY);
  }
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
function drawHelpPanel() {
  let x = width - 300;
  let y = 40;
  const lineHeight = 20;
  const categorySpacing = 15;

  // --- Main title ---
  fill(255);
  noStroke();
  textSize(18);
  textAlign(LEFT, TOP);
  text('TinyGraph Guide', x, y);
  y += lineHeight * 2;

  // --- Loop through each category (Mouse, Hotkeys) ---
  for (const category of HELP_TEXT) {
    // Category title
    fill(200);
    textAlign(RIGHT, TOP);
    textSize(14);
    text(category.category, x, y);
    y += lineHeight * 1.5;

    // Items in the category
    textSize(12);
    for (const item of category.items) {
      // Key
      fill(255);
      textAlign(LEFT, TOP);
      text(item.key, x + 10, y);

      // Description
      fill(150);
      textAlign(RIGHT, TOP);
      // Position the description to the right, aligned with a fixed width
      text(item.desc, x + 200, y);

      y += lineHeight;
    }
    y += categorySpacing;
  }
}
function updateHoveredNode() {
  hoveredNode = null;
  for (let node of nodes) {
    if (node.isHovered()) {
      hoveredNode = node;
      break;
    }
  }
}
// -------------------------------
//  EVENT HANDLERS (INPUT)
// -------------------------------
function mousePressed() {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

  const indexH = nodes.indexOf(hoveredNode);
  const indexS = nodes.indexOf(selectedNode);

  // Right-click to delete
  if (mouseButton === RIGHT) {
    if (hoveredNode){
      nodes.splice(indexH, 1);
      edges = edges.filter(edge => edge[0] !== hoveredNode && edge[1] !== hoveredNode);
      if (indexS === indexH) selectedNode = null;
      updateNodesID();
      saveState();
    }
    return false;
  }

  // Create or connect nodes
  if (!hoveredNode && !keyIsDown(KEY_CODE_MAP['space'])) {
    let newNode = new Node(canvasX, canvasY, (nodes.length + 1));
    nodes.push(newNode);
    selectedNode = null;
    isConnectingNode = false;
    updateUIState();
    saveState();
  } else if (!isConnectingNode) {
    selectedNode = hoveredNode;
  } else if (isConnectingNode){
    attemptConnection(hoveredNode);
  }
  if(selectedNode === hoveredNode && hoveredNode && !isConnectingNode){
    draggedNode = selectedNode;
  }
}
function mouseDragged(){
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  const index = nodes.indexOf(draggedNode);

  if(draggedNode){
    draggedNode.tx = canvasX;
    draggedNode.ty = canvasY;
  } else if(keyIsDown(KEY_CODE_MAP['space'])){
    offsetX += mouseX - pmouseX;
    offsetY += mouseY - pmouseY;
  }
}
function mouseReleased(){
  if(draggedNode){
    draggedNode = null;
    saveState();
  }
}
function mouseMoved(){}
function mouseClicked(){}
function mouseWheel(event){
  let zoomSensitivity = -0.001;
  applyZoom(event.delta * zoomSensitivity, mouseX, mouseY);
  return false; // prevents page scroll
}
function keyPressed() {
  let combo = getKeyCombo(key, keyCode);
  if(hotkeys[combo]) {
    hotkeys[combo]();
    return false;
  }
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight * 3/4);
  positionUI();

  for (let node of nodes) {
    node.tx = constrain(node.tx, 0, width);
    node.ty = constrain(node.ty, 0, height);
  }
}
// -------------------------------
//  EVENT HANDLERS (UI)
// -------------------------------
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
function handleZoom(){
  let newZoom = zoomSlider.value();
  let delta = newZoom - zoom;
  applyZoom(delta, width / 2, height / 2);
}
function handleOverlapButton(){
  isAllowOverlap = !isAllowOverlap;
  updateUIState();
}
function handleBoundaryButton(){
  isBoundaryStatic = !isBoundaryStatic;
  updateUIState();
}
function handlePreviewButton(){
  isDrawPreview = !isDrawPreview;
  updateUIState();
}
// -------------------------------
//  CAMERA & COORDINATES HELPERS
// -------------------------------
function applyZoom(delta, pivotX, pivotY){
  let newZoom = zoom + delta;
  newZoom = constrain(newZoom, MIN_ZOOM, MAX_ZOOM);

  let world = screenToWorld(pivotX, pivotY);

  offsetX = pivotX - world.x * newZoom;
  offsetY = pivotY - world.y * newZoom;

  zoom = newZoom;
  zoomSlider.value(zoom);
}
function getCanvasMousePos(){
  let world = screenToWorld(mouseX, mouseY);
  canvasX = world.x;
  canvasY = world.y;
}
function positionUI() {
  connectButton.position(0, height + 10);
  labelButton.position(0, height + 40);
  overlapButton.position(0, height + 70);
  zoomSlider.position(0, height + 100);
  boundaryButton.position(0, height + 130);
  saveButton.position(200, height + 10);
  loadButton.position(200, height + 40);
  previewButton.position(200, height + 70)
}
function updateWorldBounds(){
  if(isBoundaryStatic){
    worldBounds.left = 0;
    worldBounds.top = 0;
    worldBounds.right = width;
    worldBounds.bottom = height;
  } else {
    let topLeft = screenToWorld(0, 0);
    let bottomRight = screenToWorld(width, height);

    worldBounds.left = topLeft.x;
    worldBounds.top = topLeft.y;
    worldBounds.right = bottomRight.x;
    worldBounds.bottom = bottomRight.y;
  }
}
function home(){
  zoom = 1;
  offsetX = 0;
  offsetY = 0;
}
function screenToWorld(mx, my) {
  let worldX = (mx - offsetX) / zoom;
  let worldY = (my - offsetY) / zoom;
  return createVector(worldX, worldY);
}
// -------------------------------
//  LOGIC & SERVICES
// -------------------------------
function attemptConnection(targetNode) {
  if (!selectedNode || !targetNode || selectedNode === targetNode) return;

  let exists = edges.some(
    ([a, b]) =>
      (a === selectedNode && b === targetNode) ||
      (a === targetNode && b === selectedNode)
  );

  if (!exists) {
    edges.push([selectedNode, targetNode]);
    saveState();
    createToast(`Connected ${selectedNode.id} → ${targetNode.id}`);
  } else {
    createToast("These nodes are already connected.");
  }

  isConnectingNode = false;
  selectedNode = null;
  updateUIState();
}
function updateNodesID(){
  for (let i = 0; i < nodes.length; i++){
    nodes[i].id = (i+1);
  }
}
function updateUIState() {
  connectButton.html("Connect Node | " + (isConnectingNode ? "ON" : "OFF"));
  labelButton.html("Always show labels | " + (isLabelsAlwaysVisible ? "ON" : "OFF"));
  overlapButton.html("Allow overlap | " + (isAllowOverlap ? "ON" : "OFF"));
  boundaryButton.html("Static boundary | " + (isBoundaryStatic ? "ON" : "OFF"));
  previewButton.html("Add node preview | " + (isDrawPreview ? "ON" : "OFF"));
}
function connectModeOn(){
  if(!isConnectingNode){
    handleConnectButton();
  }
}
function connectModeOff(){
  if(isConnectingNode){
    isConnectingNode = false;
    selectedNode = null;
    updateUIState();
  }
}
function zoomIn(value=0.1){
  applyZoom(value, width / 2, height / 2);
}
function zoomOut(value=0.1){
  applyZoom(-value, width / 2, height / 2);
}
function regHotkey(keyCombo, action){
  hotkeys[keyCombo.toLowerCase()] = action;
}
function getKeyCombo(k, c) { // It now accepts the key and keyCode as arguments
  let parts = [];

  if (keyIsDown(CONTROL)) parts.push('ctrl');
  if (keyIsDown(SHIFT)) parts.push('shift');
  if (keyIsDown(ALT)) parts.push('alt');

  let primaryKey;
  if (KEY_NAME_MAP[c]) {
    primaryKey = KEY_NAME_MAP[c];
  } else if (typeof k === 'string' && k.length === 1) {
    primaryKey = k.toLowerCase();
  }


  if (primaryKey) {
    parts.push(primaryKey);
  }

  return parts.join('+');
}
function createToast(message, duration = 3000) {
  toasts.push({
    message,
    createdAt: millis(),
    duration,
  });
}
// -------------------------------
// HISTORY MANAGEMENT
// -------------------------------
function createSnapshot() {
  const snapshotNodes = nodes.map(n => {
    // Create a new object for each node to break references
    return {
      x: n.x,
      y: n.y,
      id: n.id,
      label: n.label,
      // Add any other properties you want to save per node
      speed: n.speed,
      friction: n.friction,
      tx: n.tx,
      ty: n.ty
    };
  });

  // Edges are more complex because they reference nodes. We'll save them by node ID.
  const snapshotEdges = edges.map(([nodeA, nodeB]) => {
    return [nodeA.id, nodeB.id];
  });

  return { nodes: snapshotNodes, edges: snapshotEdges };
}
function restoreFromSnapshot(snapshot) {
  // Clear out any lingering state
  selectedNode = null;
  draggedNode = null;
  hoveredNode = null;
  isConnectingNode = false;

  // Restore nodes
  nodes = snapshot.nodes.map(nData => {
    // Recreate Node objects from the snapshot data
    const newNode = new Node(nData.x, nData.y, nData.id);
    // Restore other properties
    Object.assign(newNode, nData);
    return newNode;
  });

  // Restore edges by finding the new node objects by their ID
  edges = snapshot.edges.map(([idA, idB]) => {
    const nodeA = nodes.find(n => n.id === idA);
    const nodeB = nodes.find(n => n.id === idB);
    // Only create the edge if both nodes were found
    return (nodeA && nodeB) ? [nodeA, nodeB] : null;
  }).filter(e => e !== null); // Filter out any null edges

  updateUIState(); // Refresh UI to reflect any changes
}
function saveState() {
  // Clear the redo stack because we've started a new history branch
  redoStack = [];

  undoStack.push(createSnapshot());

  if (undoStack.length > HISTORY_LIMIT) {
    undoStack.shift(); // Remove the oldest item
  }
}
function saveGraph() {
  const snapshot = createSnapshot();
  const jsonString = JSON.stringify(snapshot, null, 2);
  saveJSON(snapshot, 'my-tiny-graph.json');
  createToast("Graph saved as my-tiny-graph.json");
}
function undo() {
  if (undoStack.length <= 1) { // Can't undo the initial empty state
    createToast("Nothing to undo.");
    return;
  }

  // Pop the current state off the undo stack and move it to the redo stack
  const currentState = undoStack.pop();
  redoStack.push(currentState);

  // The new "current" state is now at the top of the undo stack
  const prevState = undoStack[undoStack.length - 1];
  restoreFromSnapshot(prevState);
}
function redo() {
  if (redoStack.length === 0) {
    createToast("Nothing to redo.");
    return;
  }

  // Pop the state to restore from the redo stack
  const nextState = redoStack.pop();

  // Push it back onto the undo stack as it's now the "current" state
  undoStack.push(nextState);

  restoreFromSnapshot(nextState);
}
// -------------------------------
// FILE MANAGEMENT
// -------------------------------
function handleFileLoad(file) {
  if (file.type !== 'application' || file.subtype !== 'json') {
    createToast("Error: Please select a valid .json file.");
    return;
  }
  try {
    const snapshot = JSON.parse(file.data);
    restoreFromSnapshot(snapshot);

    // reset values
    home();
    undoStack = [createSnapshot()];
    redoStack = [];

    createToast("Graph loaded successfully!");

  } catch (error) {
    createToast("Error: Could not parse the JSON file.");
    console.error("File loading error:", error);
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
    this.label = "node " + id;

    this.tx = x;
    this.ty = y;
    this.speed = 0.1;
    this.friction = 0.8;

    this.labelVisible = isLabelsAlwaysVisible;

  }
  update(){
     // spring force
    let dx = this.tx - this.x;
    let dy = this.ty - this.y;
    this.vx += dx * this.speed;
    this.vy += dy * this.speed;

    // friction
    this.vx *= this.friction;
    this.vy *= this.friction;

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

    this.vx = (this.vx + fx);
    this.vy = (this.vy + fy);

    this.vx = constrain(this.vx, -5, 5);
    this.vy = constrain(this.vy, -5, 5);
  }
  applyBoundary(){
    const push_strength = 0.1;
    const {left, right, top, bottom} = worldBounds;
    if(this.x - this.r < left){
      let overshoot = left - this.x + this.r;
      let force = overshoot * push_strength;
      this.vx += force;
    }
    if(this.y - this.r < top){
      let overshoot = top - this.y + this.r;
      let force = overshoot * push_strength;
      this.vy += force;
    }
    if(this.x + this.r > right){
      let overshoot = this.x + this.r - right;
      let force = overshoot * push_strength;
      this.vx -= force;
    }
    if(this.y + this.r > bottom){
      let overshoot = this.y + this.r - bottom;
      let force = overshoot * push_strength;
      this.vy -= force;
    }
  }
  isHovered() {
    return dist(this.x, this.y, canvasX, canvasY) < this.r;
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
    text(this.label, this.x, this.y + this.r * 2);
  }
  highlight(type) {
    if (type === "drag") {
      noFill();
      stroke(0, 255, 0);
      ellipse(this.x, this.y, this.r * 2 + 7);
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
