// Get canvas and context.
var canvas = document.querySelector("canvas"),
    context = canvas.getContext("2d");

// Create forcesimulation
var simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(function (d) {
        return d.id;
    }))
    .force("charge", d3.forceManyBody());

// Search term will be updated on input change.
var searchTerm = "";

// Holds all highlighted nodes.
var highlightedNodes = new Set();

// The sets of nodes and links to draw.
var nodesToDraw = new Set();
var linksToDraw = new Set();

// The graph
var globalGraph;

// Selected nodes.
var selectedNode;

// The currently active isolation on 
var activeIsolation = "full_graph";

// Get data and link drawing functions.
d3.json("results.json", function (error, graph) {
    if (error)
        throw error;

    globalGraph = graph;

    // Simulation parameters.
    simulation
        .nodes(graph.nodes)
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .on("tick", ticked);

    //set links
    simulation.force("link")
        .links(graph.links);

    //link up drag events
    d3.select(canvas)
        .call(d3.drag()
            .container(canvas)
            .subject(dragsubject)
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    isolationMode(false);

    //tick function to draw image.
    function ticked() {
        var width = canvas.width;
        var height = canvas.height;
        context.clearRect(0, 0, width, height);
        context.save();
        context.translate(width / 2, height / 2);

        // Draw links.
        context.beginPath();
        linksToDraw.forEach(drawLink);
        context.strokeStyle = "#C6E8FA";
        context.stroke();

        // Draw nodes.
        context.beginPath();
        nodesToDraw.forEach(drawNode);
        context.fillStyle = "#3C9BCC"
        context.fill();

        // Draw highlighted nodes.
        context.beginPath();
        highlightedNodes.forEach(drawNode);
        context.fillStyle = "#FF8D64";
        context.fill();

        // Draw package name.
        context.beginPath();
        context.font = "20px Helvetica Neue";
        context.fillStyle = "#CC3C49";
        if (selectedNode != null) {
            drawNode(selectedNode);
            context.fillText(selectedNode.id, selectedNode.x + 15, selectedNode.y + 5);
        }
        context.fill();

        context.restore();

    }

    //finds the dragged object.
    function dragsubject() {
        return simulation.find(d3.event.x - canvas.width / 2, d3.event.y - canvas.height / 2);
    }
});

//drag started event function
function dragstarted() {
    if (!d3.event.active)
        simulation.alphaTarget(0.3).restart();

    // Set force-vector on subject.
    d3.event.subject.fx = d3.event.subject.x;
    d3.event.subject.fy = d3.event.subject.y;

    // Set current node as selected node.
    selectNode(d3.event.subject);
}

//drag in progress event function
function dragged() {
    // Update force vector on subject
    d3.event.subject.fx = d3.event.x;
    d3.event.subject.fy = d3.event.y;
}

//drag stoped event handler
function dragended() {
    if (!d3.event.active)
        simulation.alphaTarget(0);

    // Disable force vector on subject.
    d3.event.subject.fx = null;
    d3.event.subject.fy = null;
}

//draws a link between two nodes.
function drawLink(d) {
    context.moveTo(d.source.x, d.source.y);
    context.lineTo(d.target.x, d.target.y);
}

//draws a node.
function drawNode(d) {
    context.moveTo(d.x + 3, d.y);
    context.arc(d.x, d.y, Math.log2(d.size) + 1, 0, 2 * Math.PI);
}

function isolateGraph(graph, isolateNodeName, linkSet, nodeSet) {
    let nodes = {};
    graph.nodes.forEach(node => {
        nodes[node.id] = {
            node: node,
            dependencies: new Set(),
            links: new Set(),
            visited: false
        }
    });

    graph.links.forEach(link => {
        nodes[link.source.id].dependencies.add(nodes[link.target.id]);
        nodes[link.source.id].links.add(link);
    });

    nodeSet.clear();
    linkSet.clear();
    let currentNodes = new Set();
    currentNodes.add(nodes[isolateNodeName]);
    nodeSet.add(nodes[isolateNodeName].node);

    do {
        let additionalNodes = new Set();

        //add all nodes that are reachable in the current step to next nodes.
        currentNodes.forEach(node => {
            // Add the nodes to the to-draw list, and set them for the next iteration.
            node.dependencies.forEach(node => {
                additionalNodes.add(node)
                nodeSet.add(node.node);
            });
            // Add links to the to-draw list.
            node.links.forEach(link => {
                linkSet.add(link);
            });
        });

        //remove the ones we already covered in case of loops
        currentNodes.forEach(node => {
            if (additionalNodes.has(node))
                additionalNodes.delete(node);
            node.visited = true;
        });

        currentNodes = new Set();
        additionalNodes.forEach(node => {
            if (!node.visited)
                currentNodes.add(node);
        })
    } while (currentNodes.size > 0);
}

function selectNode(node) {
    $("#nodename").text(d3.event.subject.id);
    selectedNode = d3.event.subject;
    let linkSet = new Set();
    let nodeSet = new Set();
    isolateGraph(globalGraph, d3.event.subject.id, linkSet, nodeSet);
    $("#dependencylist").empty();
    nodeSet.forEach(node => {
        $("#dependencylist").append('<li class="list-group-item">' + node.id + "</li>");
    });
}

function simpleIsolate(nodename) {
    activeIsolation = nodename;
    $("#tabs li").each(function (index, value) {
        value.classList.remove("active");
    });
    $("#tab_" + nodename).addClass("active");
    if (nodename === "full_graph") {
        isolationMode(false);
    }
    else {
        linksToDraw = new Set();
        nodesToDraw = new Set();
        isolateGraph(globalGraph, nodename, linksToDraw, nodesToDraw);
        isolationMode(true);
    }
    updateSearch();
    simulation.restart();
}

function closeTab(nodename) {
    $("#tab_" + nodename).remove();
    $("#tab_full_graph").addClass("active");

    isolationMode(false);
    simulation.restart();
    event.stopPropagation();
}

function isolationMode(toggle) {
    if (!toggle) {
        linksToDraw = new Set(globalGraph.links);
        nodesToDraw = new Set(globalGraph.nodes);
    }
}

function resizeCanvas() {
    canvas.style.width = '100%';
    canvas.style.height = '2000px';
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    simulation.restart();
}

function updateSearch() {
    highlightedNodes = new Set();
    if (searchTerm !== "") {
        var searchnodes = new Set(nodesToDraw);
        searchnodes.forEach(node => {
            if (node.id.includes(searchTerm)) {
                nodesToDraw.delete(node);
                highlightedNodes.add(node);
            }
        });
    }
}

$(document).ready(function () {
    resizeCanvas();

    $("#searchbox").on("keyup paste", function () {
        simulation.restart();
    });

    $("#isolate").click(function () {
        simpleIsolate(selectedNode.id);
    });

    $("#isolate_selected").click(function () {
        if ($("#tab_" + selectedNode.id).length != 0) {
            simpleIsolate(selectedNode.id)
        }
        else {
            simpleIsolate(selectedNode.id)
            $("#tabs li").each(function (index, value) {
                value.classList.remove("active");
            });
            $("#tabs").append('<li id="tab_' + selectedNode.id + '" class="active" onClick="simpleIsolate(\'' + selectedNode.id + '\')"><a href="#">' + selectedNode.id + '&nbsp;&nbsp;<button class="close" type="button" onClick="closeTab(\'' + selectedNode.id + '\')">×</button></a></li>').click();
        }
    });

    $("#searchbox").on("input", function () {
        searchTerm = $("#searchbox").val();
        simpleIsolate(activeIsolation);
    });

    $(window).resize(resizeCanvas);
})


