// Datasets for Demonstration
const DATASETS = {
    techEnterprise: {
        name: "Global Enterprise",
        children: [
            {
                name: "Cloud & Infrastructure",
                children: [
                    {
                        name: "Compute & Containers",
                        children: [
                            { name: "Virtual Machines (EC2)", value: 45000000 },
                            { name: "Kubernetes Engine (EKS)", value: 38000000 },
                            { name: "Serverless Lambda", value: 24000000 }
                        ]
                    },
                    {
                        name: "Storage & Databases",
                        children: [
                            { name: "Object Storage (S3)", value: 52000000 },
                            { name: "Managed SQL (Postgres)", value: 31000000 },
                            { name: "NoSQL DynamoDB", value: 29000000 }
                        ]
                    },
                    {
                        name: "AI & Machine Learning",
                        children: [
                            { name: "Model Inference APIs", value: 68000000 },
                            { name: "Fine-Tuning Pipelines", value: 42000000 },
                            { name: "Vector Search DBs", value: 25000000 }
                        ]
                    }
                ]
            },
            {
                name: "Software & SaaS",
                children: [
                    {
                        name: "Productivity Suite",
                        children: [
                            { name: "Enterprise Email", value: 34000000 },
                            { name: "Real-time Collaboration", value: 28000000 },
                            { name: "Document Cloud", value: 22000000 }
                        ]
                    },
                    {
                        name: "Security & Identity",
                        children: [
                            { name: "Zero Trust SSO", value: 39000000 },
                            { name: "Cloud SIEM & XDR", value: 31000000 },
                            { name: "Secret Vault", value: 16000000 }
                        ]
                    }
                ]
            },
            {
                name: "Hardware & Devices",
                children: [
                    {
                        name: "Workstations & Laptops",
                        children: [
                            { name: "Pro Series 16-inch", value: 41000000 },
                            { name: "Ultrabook 14-inch", value: 33000000 }
                        ]
                    },
                    {
                        name: "Data Center Racks",
                        children: [
                            { name: "AI Accelerator Blades", value: 75000000 },
                            { name: "High-Bandwidth Switches", value: 27000000 }
                        ]
                    }
                ]
            }
        ]
    },
    carbonEmissions: {
        name: "Global GHG Emissions",
        children: [
            {
                name: "Energy (Electricity & Heat)",
                children: [
                    {
                        name: "Industry Power",
                        children: [
                            { name: "Iron & Steel Production", value: 7200 },
                            { name: "Chemical & Petrochemical", value: 5800 },
                            { name: "Machinery Manufacturing", value: 3100 }
                        ]
                    },
                    {
                        name: "Residential & Commercial",
                        children: [
                            { name: "Residential Heating/Cooling", value: 6100 },
                            { name: "Commercial Office Power", value: 4400 }
                        ]
                    }
                ]
            },
            {
                name: "Transport",
                children: [
                    {
                        name: "Road Transport",
                        children: [
                            { name: "Passenger Vehicles", value: 5900 },
                            { name: "Freight Road Trucks", value: 4800 }
                        ]
                    },
                    {
                        name: "Aviation & Shipping",
                        children: [
                            { name: "Commercial Aviation", value: 2200 },
                            { name: "Maritime Cargo", value: 2100 }
                        ]
                    }
                ]
            },
            {
                name: "Agriculture & Land Use",
                children: [
                    {
                        name: "Livestock & Manure",
                        children: [
                            { name: "Cattle & Dairy", value: 5300 },
                            { name: "Other Livestock", value: 1900 }
                        ]
                    },
                    {
                        name: "Agricultural Soils",
                        children: [
                            { name: "Synthetic Fertilizers", value: 3800 },
                            { name: "Rice Cultivation", value: 2100 }
                        ]
                    }
                ]
            }
        ]
    }
};

// State
let currentDatasetKey = "techEnterprise";
let currentData = DATASETS[currentDatasetKey];
let paletteName = "tableau10";
let innerRadiusRatio = 0.25;
let cornerRadius = 3;
let padAngle = 0.005;
let showLabels = true;
let focusNode = null;
let rootNode = null;

// Color scales
function getPalette(name) {
    switch (name) {
        case "category10": return d3.schemeCategory10;
        case "paired": return d3.schemePaired;
        case "spectral": return ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"];
        case "accent": return d3.schemeAccent;
        default: return d3.schemeTableau10;
    }
}

// Format numbers
function formatVal(v) {
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1) + "k";
    return v.toLocaleString();
}

// Chart Render Engine
function render() {
    const container = document.getElementById("chart");
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;
    const radius = Math.min(width, height) / 2 - 16;
    const colorScale = d3.scaleOrdinal(getPalette(paletteName));

    // Clear previous
    container.innerHTML = "";

    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("display", "block");

    const mainGroup = svg.append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Hierarchy & Partition
    const hierarchy = d3.hierarchy(currentData)
        .sum(d => (d.children && d.children.length > 0) ? 0 : d.value)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition().size([2 * Math.PI, radius]);
    rootNode = partition(hierarchy);

    if (!focusNode || !findNode(rootNode, focusNode)) {
        focusNode = rootNode;
    } else {
        focusNode = findNode(rootNode, focusNode);
    }

    const innerHole = radius * innerRadiusRatio;

    // Scales mapped to focus
    const x = d3.scaleLinear()
        .domain([focusNode.x0, focusNode.x1])
        .range([0, 2 * Math.PI])
        .clamp(true);

    const y = d3.scaleLinear()
        .domain([focusNode.y0, radius])
        .range([innerHole, radius])
        .clamp(true);

    // Arc generator
    const arc = d3.arc()
        .startAngle(d => x(d.x0))
        .endAngle(d => x(d.x1))
        .padAngle(d => Math.min((x(d.x1) - x(d.x0)) / 2, padAngle))
        .padRadius(radius / 2)
        .innerRadius(d => Math.max(0, y(d.y0)))
        .outerRadius(d => Math.max(y(d.y0), y(d.y1) - 1))
        .cornerRadius(cornerRadius);

    const visibleDescendants = rootNode.descendants().filter(d => d.depth > 0);

    // Draw Slices
    const slices = mainGroup.selectAll(".sunburst-slice")
        .data(visibleDescendants)
        .enter()
        .append("path")
        .attr("class", "sunburst-slice")
        .attr("d", arc)
        .attr("fill", d => {
            let topAncestor = d;
            while (topAncestor.depth > 1 && topAncestor.parent) {
                topAncestor = topAncestor.parent;
            }
            return colorScale(topAncestor.data.name);
        })
        .style("display", d => isDescendant(d, focusNode) ? null : "none");

    const tooltip = d3.select("#tooltip");

    slices
        .on("click", (event, d) => {
            event.stopPropagation();
            if (d.children && d.children.length > 0) {
                focusNode = d;
                render();
            }
        })
        .on("mouseover", (event, d) => {
            const total = rootNode.value || 1;
            const pctTotal = ((d.value / total) * 100).toFixed(1);
            const parentVal = (d.parent && d.parent.value) ? d.parent.value : d.value;
            const pctParent = ((d.value / parentVal) * 100).toFixed(1);

            let pathStr = "";
            let curr = d;
            const pathArr = [];
            while (curr) {
                pathArr.unshift(curr.data.name);
                curr = curr.parent;
            }
            pathStr = pathArr.join(" &rarr; ");

            tooltip
                .style("display", "block")
                .html(`
                    <div class="tt-title">${d.data.name}</div>
                    <div class="tt-row"><span>Path:</span> <span>${pathStr}</span></div>
                    <div class="tt-row"><span>Value:</span> <strong>${formatVal(d.value)}</strong></div>
                    <div class="tt-row"><span>Share of Parent:</span> <span>${pctParent}%</span></div>
                    <div class="tt-row"><span>Share of Total:</span> <span>${pctTotal}%</span></div>
                `);
        })
        .on("mousemove", (event) => {
            const chartBox = container.getBoundingClientRect();
            tooltip
                .style("left", (event.clientX - chartBox.left + 15) + "px")
                .style("top", (event.clientY - chartBox.top + 15) + "px");
        })
        .on("mouseout", () => {
            tooltip.style("display", "none");
        });

    // Slice Labels
    if (showLabels) {
        const visibleLabels = visibleDescendants.filter(d => {
            if (!isDescendant(d, focusNode)) return false;
            return (x(d.x1) - x(d.x0)) > 0.09;
        });

        mainGroup.selectAll(".sunburst-label")
            .data(visibleLabels)
            .enter()
            .append("text")
            .attr("class", "sunburst-label")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("transform", d => {
                const angle = (x(d.x0) + x(d.x1)) / 2 * 180 / Math.PI;
                const r = (y(d.y0) + y(d.y1)) / 2;
                return `rotate(${angle - 90}) translate(${r},0) rotate(${angle < 180 ? 0 : 180})`;
            })
            .text(d => {
                const availableAngle = x(d.x1) - x(d.x0);
                const maxChars = Math.floor(availableAngle * 12);
                if (maxChars < 3) return "";
                const name = d.data.name;
                return name.length > maxChars ? name.slice(0, maxChars - 1) + "\u2026" : name;
            });
    }

    // Center Circle (Zoom Out)
    const centerGroup = mainGroup.append("g").attr("class", "center-group");

    centerGroup.append("circle")
        .attr("class", "center-circle")
        .attr("r", Math.max(16, innerHole - 2))
        .on("click", (event) => {
            event.stopPropagation();
            if (focusNode && focusNode.parent) {
                focusNode = focusNode.parent;
                render();
            }
        });

    const isRoot = !focusNode.parent;

    centerGroup.append("text")
        .attr("class", "center-text-title")
        .attr("dy", "-0.6em")
        .text(isRoot ? "Total" : focusNode.data.name);

    centerGroup.append("text")
        .attr("class", "center-text-value")
        .attr("dy", "0.7em")
        .text(formatVal(focusNode.value || 0));

    if (!isRoot) {
        centerGroup.append("text")
            .attr("class", "center-text-hint")
            .attr("dy", "2.1em")
            .text("Zoom Out");
    }

    // Update Breadcrumbs & Metric displays
    updateBreadcrumbs(focusNode);
    updateMetrics(focusNode, rootNode);
}

function isDescendant(node, ancestor) {
    let curr = node;
    while (curr) {
        if (curr === ancestor) return true;
        curr = curr.parent;
    }
    return false;
}

function findNode(root, target) {
    if (root.data.name === target.data.name && root.depth === target.depth) {
        return root;
    }
    if (root.children) {
        for (const child of root.children) {
            const found = findNode(child, target);
            if (found) return found;
        }
    }
    return null;
}

function updateBreadcrumbs(node) {
    const bar = document.getElementById("breadcrumbsBar");
    bar.innerHTML = "";

    const path = [];
    let curr = node;
    while (curr) {
        path.unshift(curr);
        curr = curr.parent;
    }

    path.forEach((p, idx) => {
        if (idx > 0) {
            const sep = document.createElement("span");
            sep.className = "crumb-separator";
            sep.textContent = "/";
            bar.appendChild(sep);
        }

        const item = document.createElement("span");
        item.className = "crumb-item" + (idx === path.length - 1 ? " crumb-active" : "");
        item.textContent = idx === 0 ? "Total" : p.data.name;
        item.addEventListener("click", () => {
            focusNode = p;
            render();
        });
        bar.appendChild(item);
    });
}

function updateMetrics(node, root) {
    document.getElementById("focusValueDisplay").textContent = formatVal(node.value || 0);
    const total = root.value || 1;
    const share = ((node.value / total) * 100).toFixed(1);
    document.getElementById("focusShareDisplay").textContent = `${share}% of Total`;
}

// Wire Event Listeners
document.getElementById("datasetSelect").addEventListener("change", (e) => {
    currentDatasetKey = e.target.value;
    currentData = DATASETS[currentDatasetKey];
    focusNode = null;
    render();
});

document.getElementById("paletteSelect").addEventListener("change", (e) => {
    paletteName = e.target.value;
    render();
});

document.getElementById("innerRadius").addEventListener("input", (e) => {
    innerRadiusRatio = parseFloat(e.target.value);
    document.getElementById("innerRadiusVal").textContent = innerRadiusRatio.toFixed(2);
    render();
});

document.getElementById("cornerRadius").addEventListener("input", (e) => {
    cornerRadius = parseInt(e.target.value);
    document.getElementById("cornerRadiusVal").textContent = cornerRadius;
    render();
});

document.getElementById("padAngle").addEventListener("input", (e) => {
    padAngle = parseFloat(e.target.value);
    document.getElementById("padAngleVal").textContent = padAngle.toFixed(3);
    render();
});

document.getElementById("showLabels").addEventListener("change", (e) => {
    showLabels = e.target.checked;
    render();
});

document.getElementById("resetZoomBtn").addEventListener("click", () => {
    focusNode = rootNode;
    render();
});

window.addEventListener("resize", () => {
    render();
});

// Initial Render
render();
