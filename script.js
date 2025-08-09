class BrushWaferSimulator {
            constructor() {
                this.brushCanvas = document.getElementById('brushCanvas');
                this.brushCtx = this.brushCanvas.getContext('2d');
                this.detailCanvas = document.getElementById('detailCanvas');
                this.detailCtx = this.detailCanvas.getContext('2d');
                this.animationCanvas = document.getElementById('animationCanvas');
                this.animationCtx = this.animationCanvas.getContext('2d');
                this.profileCanvas = document.getElementById('profileCanvas');
                this.profileCtx = this.profileCanvas.getContext('2d');
                
                this.isAnimating = false;
                this.animationId = null;
                this.startTime = null;
                this.contactData = null;
                this.selectedNodules = new Set(); // Track selected (disabled) nodules
                this.currentNodules = []; // Store current nodule data for click detection
                
                this.setupEventListeners();
                this.updateBrushVisualization();
                this.updateDetailDiagram();
                this.updateProfileDiagram();
                this.initializeContactMap();
            }
            
            setupEventListeners() {
                // Input change listeners
                const inputs = ['brushLength', 'brushDiameter', 'brushSpeed', 'waferSpeed', 
                               'noduleRows', 'nodulesPerRow', 'nodulePitch', 'noduleDiameter', 
                               'noduleStartOdd', 'noduleStartEven', 'brushContour', 'contourDepth', 
                               'brushCompression', 'dataDensity', 'processTime'];
                
                inputs.forEach(id => {
                    document.getElementById(id).addEventListener('input', () => {
                        this.updateBrushVisualization();
                        this.updateDetailDiagram();
                        this.updateProfileDiagram();
                        if (!this.isAnimating) {
                            this.initializeContactMap();
                        }
                    });
                });
                
                // Button listeners
                document.getElementById('startBtn').addEventListener('click', () => this.startAnimation());
                document.getElementById('stopBtn').addEventListener('click', () => this.stopAnimation());
                document.getElementById('clearBtn').addEventListener('click', () => this.clearAndReset());
                document.getElementById('clearHeatMapBtn').addEventListener('click', () => this.clearHeatMap());
                document.getElementById('clearNodulesBtn').addEventListener('click', () => this.clearSelectedNodules());
                document.getElementById('reverseMapBtn').addEventListener('click', () => this.showNonContactedAreas());
                document.getElementById('lowContactMapBtn').addEventListener('click', () => this.showLowContactAreas());
                document.getElementById('exportBtn').addEventListener('click', () => this.exportConfiguration());
                
                // Canvas click listener for nodule selection
                this.brushCanvas.addEventListener('click', (e) => this.handleBrushCanvasClick(e));
            }
            
            getInputValues() {
                return {
                    brushLength: parseFloat(document.getElementById('brushLength').value),
                    brushDiameter: parseFloat(document.getElementById('brushDiameter').value),
                    brushSpeed: parseFloat(document.getElementById('brushSpeed').value),
                    waferSpeed: parseFloat(document.getElementById('waferSpeed').value),
                    waferDiameter: parseFloat(document.getElementById('waferDiameter').value),
                    noduleRows: parseInt(document.getElementById('noduleRows').value),
                    nodulesPerRow: parseInt(document.getElementById('nodulesPerRow').value),
                    nodulePitch: parseFloat(document.getElementById('nodulePitch').value),
                    noduleDiameter: parseFloat(document.getElementById('noduleDiameter').value),
                    noduleStartOdd: parseFloat(document.getElementById('noduleStartOdd').value),
                    noduleStartEven: parseFloat(document.getElementById('noduleStartEven').value),
                    brushContour: document.getElementById('brushContour').value,
                    contourDepth: parseFloat(document.getElementById('contourDepth').value),
                    brushCompression: parseFloat(document.getElementById('brushCompression').value),
                    dataDensity: document.getElementById('dataDensity').value,
                    processTime: parseFloat(document.getElementById('processTime').value)
                };
            }
            
            updateBrushVisualization() {
                const params = this.getInputValues();
                const ctx = this.brushCtx;
                const canvas = this.brushCanvas;
                
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Calculate dimensions
                const margin = 20;
                const rectWidth = canvas.width - 2 * margin;
                const rectHeight = canvas.height - 2 * margin;
                const circumference = Math.PI * params.brushDiameter;
                
                // Draw brush surface (light gray)
                ctx.fillStyle = 'lightgray';
                ctx.fillRect(margin, margin, rectWidth, rectHeight);
                
                // Draw border
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.strokeRect(margin, margin, rectWidth, rectHeight);
                
                // Calculate nodule positions
                const nodules = this.calculateNodulePositions(params);
                this.currentNodules = []; // Reset stored nodule data
                
                // Draw nodules with individual colors based on selection state and contact ability
                nodules.forEach(nodule => {
                    const x = margin + (nodule.axialPos / params.brushLength) * rectWidth;
                    const y = margin + (nodule.circumPos / circumference) * rectHeight;
                    const radius = (params.noduleDiameter / 2) * (rectWidth / params.brushLength);
                    
                    // Create unique ID for nodule
                    const noduleId = `${nodule.row}-${nodule.index}`;
                    
                    // Store nodule info for click detection
                    this.currentNodules.push({
                        id: noduleId,
                        x: x,
                        y: y,
                        radius: Math.max(radius, 2),
                        row: nodule.row,
                        index: nodule.index
                    });
                    
                    // Determine if nodule can make contact based on compression
                    const canMakeContact = this.canNoduleContact(nodule, params);
                    
                    // Choose color based on selection state and contact ability
                    let fillColor, strokeColor;
                    if (this.selectedNodules.has(noduleId)) {
                        fillColor = 'black';
                        strokeColor = '#333';
                    } else if (!canMakeContact) {
                        fillColor = '#ffcccc'; // Light red for non-contacting
                        strokeColor = '#ff6666';
                    } else {
                        fillColor = 'white';
                        strokeColor = '#333';
                    }
                    
                    ctx.fillStyle = fillColor;
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = 1;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, Math.max(radius, 2), 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                });
                
                // Add labels
                ctx.fillStyle = '#666';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`Length: ${params.brushLength}mm`, canvas.width / 2, margin - 5);
                
                ctx.save();
                ctx.translate(margin - 5, canvas.height / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(`Circumference: ${circumference.toFixed(1)}mm`, 0, 0);
                ctx.restore();
            }
            
            calculateNodulePositions(params) {
                const nodules = [];
                const circumference = Math.PI * params.brushDiameter;
                
                // Nodule rows run along the length of the brush
                for (let row = 0; row < params.noduleRows; row++) {
                    // Each row is at a different circumferential position
                    const circumPos = (row / params.noduleRows) * circumference;
                    const angle = (row / params.noduleRows) * 2 * Math.PI;
                    
                    // Determine start position based on whether row is odd or even
                    // Row numbering: 0=odd(1st), 1=even(2nd), 2=odd(3rd), 3=even(4th), etc.
                    const startPos = (row % 2 === 0) ? params.noduleStartOdd : params.noduleStartEven;
                    
                    // Nodules in each row are spaced along the length
                    for (let i = 0; i < params.nodulesPerRow; i++) {
                        const axialPos = startPos + i * params.nodulePitch;
                        
                        if (axialPos <= params.brushLength) {
                            // Calculate brush surface height at this axial position
                            const surfaceHeight = this.calculateBrushSurfaceHeight(axialPos, params);
                            
                            nodules.push({
                                axialPos: axialPos,
                                circumPos: circumPos,
                                angle: angle,
                                row: row,
                                index: i,
                                surfaceHeight: surfaceHeight
                            });
                        }
                    }
                }
                
                return nodules;
            }
            
            canNoduleContact(nodule, params) {
                // Find the maximum surface height (tallest point on brush)
                const allNodules = this.calculateNodulePositions(params);
                const maxSurfaceHeight = Math.max(...allNodules.map(n => n.surfaceHeight));
                
                // For concave/convex profiles, we need to reverse the contact logic
                // because the visual display and contact behavior work in opposite directions
                let effectiveHeight = nodule.surfaceHeight;
                if (params.brushContour === 'concave' || params.brushContour === 'convex') {
                    // Flip the height for contact calculation only
                    effectiveHeight = -nodule.surfaceHeight;
                    const flippedMaxHeight = Math.max(...allNodules.map(n => -n.surfaceHeight));
                    const heightDifference = flippedMaxHeight - effectiveHeight;
                    return params.brushCompression >= heightDifference;
                } else {
                    // For tapers and flat, use normal logic
                    const heightDifference = maxSurfaceHeight - nodule.surfaceHeight;
                    return params.brushCompression >= heightDifference;
                }
            }
            
            updateProfileDiagram() {
                const params = this.getInputValues();
                const ctx = this.profileCtx;
                const canvas = this.profileCanvas;
                
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                const margin = 30;
                const diagramWidth = canvas.width - 2 * margin;
                const diagramHeight = canvas.height - 2 * margin;
                const centerY = canvas.height / 2;
                
                // Draw baseline (nominal brush surface)
                ctx.strokeStyle = '#ddd';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(margin, centerY);
                ctx.lineTo(margin + diagramWidth, centerY);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Draw profile curve
                ctx.strokeStyle = '#2196F3';
                ctx.lineWidth = 3;
                ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
                
                ctx.beginPath();
                let isFirstPoint = true;
                
                for (let x = 0; x <= diagramWidth; x += 2) {
                    const normalizedPos = x / diagramWidth;
                    const axialPos = normalizedPos * params.brushLength;
                    const height = this.calculateBrushSurfaceHeight(axialPos, params);
                    
                    // Reverse the display for tapers and random to match visual expectation
                    let displayHeight = height;
                    if (params.brushContour === 'taperLeft' || params.brushContour === 'taperRight' || params.brushContour === 'random') {
                        displayHeight = -height; // Flip the visual representation
                    }
                    
                    // Scale height for display (exaggerate for visibility)
                    const scaledHeight = (displayHeight / Math.max(params.contourDepth, 0.1)) * (diagramHeight / 3);
                    const y = centerY - scaledHeight;
                    
                    if (isFirstPoint) {
                        ctx.moveTo(margin + x, y);
                        isFirstPoint = false;
                    } else {
                        ctx.lineTo(margin + x, y);
                    }
                }
                
                // Fill area under curve
                ctx.lineTo(margin + diagramWidth, centerY);
                ctx.lineTo(margin, centerY);
                ctx.closePath();
                ctx.fill();
                
                // Draw curve outline
                ctx.beginPath();
                isFirstPoint = true;
                for (let x = 0; x <= diagramWidth; x += 2) {
                    const normalizedPos = x / diagramWidth;
                    const axialPos = normalizedPos * params.brushLength;
                    const height = this.calculateBrushSurfaceHeight(axialPos, params);
                    
                    // Reverse the display for tapers and random to match visual expectation
                    let displayHeight = height;
                    if (params.brushContour === 'taperLeft' || params.brushContour === 'taperRight' || params.brushContour === 'random') {
                        displayHeight = -height; // Flip the visual representation
                    }
                    
                    const scaledHeight = (displayHeight / Math.max(params.contourDepth, 0.1)) * (diagramHeight / 3);
                    const y = centerY - scaledHeight;
                    
                    if (isFirstPoint) {
                        ctx.moveTo(margin + x, y);
                        isFirstPoint = false;
                    } else {
                        ctx.lineTo(margin + x, y);
                    }
                }
                ctx.stroke();
                
                // Draw wafer surface line (compression line)
                // At 0mm compression, wafer surface should just touch the lowest point of brush
                const allNodules = this.calculateNodulePositions(params);
                const minSurfaceHeight = Math.min(...allNodules.map(n => n.surfaceHeight));
                
                // Wafer surface starts at lowest point, moves up with compression
                const waferSurfaceHeight = minSurfaceHeight + params.brushCompression;
                
                // For the VISUAL display only, apply transformations to match brush profile display
                let displayWaferHeight = waferSurfaceHeight;
                if (params.brushContour === 'taperLeft' || params.brushContour === 'taperRight') {
                    // For tapers, adjust the starting position to be below the contour
                    displayWaferHeight = waferSurfaceHeight - (params.contourDepth || 1);
                }
                
                const scaledWaferHeight = (displayWaferHeight / Math.max(params.contourDepth, 0.1)) * (diagramHeight / 3);
                const waferY = centerY - scaledWaferHeight;
                
                ctx.strokeStyle = '#ff6666';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(margin, waferY);
                ctx.lineTo(margin + diagramWidth, waferY);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Label wafer surface line
                ctx.fillStyle = '#ff6666';
                ctx.font = '10px Arial';
                ctx.textAlign = 'right';
                if (params.brushCompression === 0) {
                    ctx.fillText(`Wafer Surface (No compression)`, margin + diagramWidth - 5, waferY - 5);
                } else {
                    ctx.fillText(`Wafer Surface (${params.brushCompression}mm compression)`, margin + diagramWidth - 5, waferY - 5);
                }
                
                // Add labels
                ctx.fillStyle = '#666';
                ctx.font = '10px Arial';
                ctx.textAlign = 'left';
                ctx.fillText('0mm', margin, canvas.height - 5);
                ctx.textAlign = 'right';
                ctx.fillText(`${params.brushLength}mm`, margin + diagramWidth, canvas.height - 5);
                ctx.textAlign = 'center';
                ctx.fillText('Brush Length', margin + diagramWidth / 2, canvas.height - 5);
                
                // Update profile info text
                const contourNames = {
                    'flat': 'Flat Profile',
                    'concave': `Concave Profile (${params.contourDepth}mm depth)`,
                    'convex': `Convex Profile (${params.contourDepth}mm height)`,
                    'taperLeft': `Left Taper (${params.contourDepth}mm rise)`,
                    'taperRight': `Right Taper (${params.contourDepth}mm rise)`,
                    'random': `Random Profile (±${params.contourDepth}mm variation)`
                };
                
                document.getElementById('profileInfo').textContent = contourNames[params.brushContour] || 'Unknown Profile';
            }
            
            calculateBrushSurfaceHeight(axialPos, params) {
                // Use full brush length for taper calculations
                const normalizedPos = axialPos / params.brushLength; // 0 to 1 across entire brush
                let heightVariation = 0;
                
                switch (params.brushContour) {
                    case 'flat':
                        heightVariation = 0;
                        break;
                    case 'concave':
                        // Concave: higher at ends, lower in center (edges contact first)
                        heightVariation = params.contourDepth * (1 - 4 * Math.pow(normalizedPos - 0.5, 2));
                        break;
                    case 'convex':
                        // Convex: higher in center, lower at ends (center contacts first)
                        heightVariation = -params.contourDepth * (1 - 4 * Math.pow(normalizedPos - 0.5, 2));
                        break;
                    case 'taperLeft':
                        // Linear taper from left (low) to right (high) - right side contacts first
                        // Use full brush length: 0mm = low end, brushLength = high end
                        heightVariation = params.contourDepth * normalizedPos;
                        break;
                    case 'taperRight':
                        // Linear taper from right (low) to left (high) - left side contacts first  
                        // Use full brush length: 0mm = high end, brushLength = low end
                        heightVariation = params.contourDepth * (1 - normalizedPos);
                        break;
                    case 'random':
                        // Pseudo-random based on position (deterministic)
                        const seed = Math.sin(normalizedPos * 17.3) * Math.cos(normalizedPos * 23.7);
                        heightVariation = params.contourDepth * seed;
                        break;
                    default:
                        heightVariation = 0;
                }
                
                return heightVariation;
            }
            
            updateDetailDiagram() {
                const params = this.getInputValues();
                const ctx = this.detailCtx;
                const canvas = this.detailCanvas;
                
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Set up dimensions and scaling
                const margin = 40;
                const diagramWidth = canvas.width - 2 * margin;
                const diagramHeight = canvas.height - 2 * margin;
                
                // Calculate scale to fit two nodules with pitch spacing
                const totalLength = params.nodulePitch * 1.5; // Show 1.5 pitch lengths
                const scale = diagramWidth / totalLength;
                
                // Draw two rows (top and bottom)
                const rowHeight = diagramHeight / 3;
                const row1Y = margin + rowHeight * 0.5;
                const row2Y = margin + rowHeight * 2;
                
                // Row 1 nodules (odd row)
                const oddStart = params.noduleStartOdd * scale + margin;
                const nodule1X = oddStart;
                const nodule2X = oddStart + params.nodulePitch * scale;
                
                // Row 2 nodules (even row) 
                const evenStart = params.noduleStartEven * scale + margin;
                const nodule3X = evenStart;
                const nodule4X = evenStart + params.nodulePitch * scale;
                
                const noduleRadius = Math.max(2, params.noduleDiameter * scale / 2); // Scale with actual diameter, minimum 2px
                
                // Draw brush surface background
                ctx.fillStyle = 'lightgray';
                ctx.fillRect(margin, margin, diagramWidth, diagramHeight);
                ctx.strokeStyle = '#999';
                ctx.lineWidth = 1;
                ctx.strokeRect(margin, margin, diagramWidth, diagramHeight);
                
                // Draw row divider
                ctx.strokeStyle = '#bbb';
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(margin, margin + diagramHeight / 2);
                ctx.lineTo(margin + diagramWidth, margin + diagramHeight / 2);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Draw nodules
                ctx.fillStyle = 'white';
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                
                // Row 1 nodules
                if (nodule1X < margin + diagramWidth) {
                    ctx.beginPath();
                    ctx.arc(nodule1X, row1Y, noduleRadius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                }
                
                if (nodule2X < margin + diagramWidth) {
                    ctx.beginPath();
                    ctx.arc(nodule2X, row1Y, noduleRadius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                }
                
                // Row 2 nodules
                if (nodule3X < margin + diagramWidth) {
                    ctx.beginPath();
                    ctx.arc(nodule3X, row2Y, noduleRadius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                }
                
                if (nodule4X < margin + diagramWidth) {
                    ctx.beginPath();
                    ctx.arc(nodule4X, row2Y, noduleRadius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                }
                
                // Draw dimension lines and labels
                ctx.strokeStyle = 'red';
                ctx.fillStyle = 'red';
                ctx.lineWidth = 1;
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                
                // Nodule pitch dimension (between nodules in same row)
                if (nodule1X < margin + diagramWidth && nodule2X < margin + diagramWidth) {
                    const dimY = row1Y - 15;
                    ctx.beginPath();
                    ctx.moveTo(nodule1X, dimY);
                    ctx.lineTo(nodule2X, dimY);
                    ctx.stroke();
                    
                    // Dimension arrows
                    ctx.beginPath();
                    ctx.moveTo(nodule1X, dimY - 3);
                    ctx.lineTo(nodule1X, dimY + 3);
                    ctx.moveTo(nodule2X, dimY - 3);
                    ctx.lineTo(nodule2X, dimY + 3);
                    ctx.stroke();
                    
                    ctx.fillText(`Pitch: ${params.nodulePitch}mm`, (nodule1X + nodule2X) / 2, dimY - 6);
                }
                
                // Start position offset dimension
                const dimY = margin + diagramHeight + 15;
                ctx.beginPath();
                ctx.moveTo(margin, dimY);
                ctx.lineTo(nodule3X, dimY);
                ctx.stroke();
                
                // Dimension arrows
                ctx.beginPath();
                ctx.moveTo(margin, dimY - 3);
                ctx.lineTo(margin, dimY + 3);
                ctx.moveTo(nodule3X, dimY - 3);
                ctx.lineTo(nodule3X, dimY + 3);
                ctx.stroke();
                
                ctx.fillText(`Even Start: ${params.noduleStartEven}mm`, (margin + nodule3X) / 2, dimY + 12);
                
                // Row-to-row overlap dimension (between closest nodules from different rows)
                if (nodule1X < margin + diagramWidth && nodule3X < margin + diagramWidth) {
                    const midY = (row1Y + row2Y) / 2;
                    
                    ctx.strokeStyle = 'purple';
                    ctx.fillStyle = 'purple';
                    ctx.lineWidth = 1;
                    
                    // Calculate the actual overlap between nodule edges
                    // Find the closest nodules from each row
                    const oddNodeX = nodule1X; // First nodule in odd row
                    const evenNodeX = nodule3X; // First nodule in even row
                    
                    let overlapDistance;
                    let dimStartX, dimEndX;
                    
                    if (evenNodeX > oddNodeX) {
                        // Even row starts after odd row
                        dimStartX = oddNodeX + noduleRadius; // Right edge of odd nodule
                        dimEndX = evenNodeX - noduleRadius; // Left edge of even nodule
                        overlapDistance = dimEndX - dimStartX;
                    } else {
                        // Odd row starts after even row
                        dimStartX = evenNodeX + noduleRadius; // Right edge of even nodule
                        dimEndX = oddNodeX - noduleRadius; // Left edge of odd nodule
                        overlapDistance = dimEndX - dimStartX;
                    }
                    
                    // Draw dimension line between nodule edges
                    ctx.beginPath();
                    ctx.moveTo(dimStartX, midY);
                    ctx.lineTo(dimEndX, midY);
                    ctx.stroke();
                    
                    // Dimension arrows
                    ctx.beginPath();
                    ctx.moveTo(dimStartX, midY - 3);
                    ctx.lineTo(dimStartX, midY + 3);
                    ctx.moveTo(dimEndX, midY - 3);
                    ctx.lineTo(dimEndX, midY + 3);
                    ctx.stroke();
                    
                    // Scale back to real dimensions
                    const realOverlapDistance = overlapDistance / scale;
                    
                    ctx.textAlign = 'center';
                    const label = realOverlapDistance >= 0 ? `Gap: ${realOverlapDistance.toFixed(1)}mm` : `Overlap: ${Math.abs(realOverlapDistance).toFixed(1)}mm`;
                    ctx.fillText(label, (dimStartX + dimEndX) / 2, midY - 6);
                }
                
                // Nodule diameter
                if (nodule1X < margin + diagramWidth) {
                    ctx.strokeStyle = 'blue';
                    ctx.fillStyle = 'blue';
                    ctx.beginPath();
                    ctx.moveTo(nodule1X - noduleRadius, row1Y + 20);
                    ctx.lineTo(nodule1X + noduleRadius, row1Y + 20);
                    ctx.stroke();
                    
                    ctx.beginPath();
                    ctx.moveTo(nodule1X - noduleRadius, row1Y + 17);
                    ctx.lineTo(nodule1X - noduleRadius, row1Y + 23);
                    ctx.moveTo(nodule1X + noduleRadius, row1Y + 17);
                    ctx.lineTo(nodule1X + noduleRadius, row1Y + 23);
                    ctx.stroke();
                    
                    ctx.textAlign = 'center';
                    ctx.fillText(`Ø${params.noduleDiameter}mm`, nodule1X, row1Y + 10);
                }
                
                // Update gap analysis in separate area
                this.updateGapAnalysis(params);
            }
            
            updateGapAnalysis(params) {
                // Simple and direct gap analysis
                const startOffset = Math.abs(params.noduleStartEven - params.noduleStartOdd);
                const noduleDiameter = params.noduleDiameter;
                
                // Calculate the effective gap between nodule edges at start positions
                const edgeToEdgeGap = startOffset - noduleDiameter;
                
                // Also check if pitch creates gaps between subsequent nodules
                let pitchGap = 0;
                if (params.nodulesPerRow > 1) {
                    // For a staggered pattern, worst case is when nodules are most offset
                    const maxOffset = Math.max(startOffset, params.nodulePitch - startOffset);
                    pitchGap = maxOffset - noduleDiameter;
                }
                
                // Use the worst (largest) gap
                const worstGap = Math.max(edgeToEdgeGap, pitchGap);
                const hasGaps = worstGap > 0;
                
                // Update warning text
                const warningElement = document.getElementById('gapWarning');
                const recommendationElement = document.getElementById('gapRecommendation');
                
                let warningText = '';
                let warningColor = '';
                
                if (hasGaps) {
                    warningText = `⚠️ Gap Warning: ${worstGap.toFixed(1)}mm gaps between adjacent rows may create non-contacted areas`;
                    warningColor = '#ff6600';
                } else {
                    warningText = '✓ Good Coverage: Nodules overlap - no gaps expected';
                    warningColor = '#008000';
                }
                
                warningElement.textContent = warningText;
                warningElement.style.color = warningColor;
                
                // Clear any previous recommendation
                recommendationElement.textContent = '';
            }
            
            initializeContactMap() {
                const params = this.getInputValues();
                const ctx = this.animationCtx;
                const canvas = this.animationCanvas;
                
                // Initialize contact data array
                const resolution = this.getResolution(params.dataDensity);
                this.contactData = Array(resolution).fill(0).map(() => Array(resolution).fill(0));
                
                // Clear canvas and draw initial wafer
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                this.drawWafer(0);
            }
            
            getResolution(density) {
                switch(density) {
                    case 'low': return 50;
                    case 'medium': return 100;
                    case 'high': return 200;
                    default: return 100;
                }
            }
            
            drawWafer(elapsedTime) {
                const params = this.getInputValues();
                const ctx = this.animationCtx;
                const canvas = this.animationCanvas;
                
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const waferRadius = Math.min(centerX, centerY) - 10;
                const resolution = this.contactData.length;
                
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw heat map
                for (let i = 0; i < resolution; i++) {
                    for (let j = 0; j < resolution; j++) {
                        const x = (i / resolution) * canvas.width;
                        const y = (j / resolution) * canvas.height;
                        
                        // Check if point is within wafer circle
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance <= waferRadius) {
                            const contactValue = this.contactData[i][j];
                            const intensity = Math.min(contactValue / 15, 1); // Adjusted normalization for better range
                            
                            // Enhanced color mapping with more variation
                            let r, g, b;
                            if (intensity === 0) {
                                // No contact - dark grey
                                r = 60; g = 60; b = 60;
                            } else if (intensity < 0.2) {
                                // Very low contact - green to light green
                                const t = intensity / 0.2;
                                r = Math.floor(t * 50);
                                g = Math.floor(150 + t * 105);
                                b = Math.floor(t * 50);
                            } else if (intensity < 0.4) {
                                // Low contact - light green to yellow-green
                                const t = (intensity - 0.2) / 0.2;
                                r = Math.floor(50 + t * 100);
                                g = 255;
                                b = Math.floor(50 - t * 50);
                            } else if (intensity < 0.6) {
                                // Medium contact - yellow-green to yellow
                                const t = (intensity - 0.4) / 0.2;
                                r = Math.floor(150 + t * 105);
                                g = 255;
                                b = 0;
                            } else if (intensity < 0.8) {
                                // High contact - yellow to orange
                                const t = (intensity - 0.6) / 0.2;
                                r = 255;
                                g = Math.floor(255 - t * 100);
                                b = 0;
                            } else {
                                // Very high contact - orange to red
                                const t = (intensity - 0.8) / 0.2;
                                r = 255;
                                g = Math.floor(155 - t * 155);
                                b = Math.floor(t * 50);
                            }
                            
                            ctx.fillStyle = `rgb(${r},${g},${b})`;
                            const pixelSize = canvas.width / resolution;
                            ctx.fillRect(x - pixelSize/2, y - pixelSize/2, pixelSize, pixelSize);
                        }
                    }
                }
                
                // Draw wafer outline
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(centerX, centerY, waferRadius, 0, 2 * Math.PI);
                ctx.stroke();
                
                // Update status
                document.getElementById('animationStatus').textContent = 
                    this.isAnimating ? `Running... ${elapsedTime.toFixed(1)}s` : 'Simulation complete';
            }
            
            startAnimation() {
                if (this.isAnimating) return;
                
                this.isAnimating = true;
                this.startTime = performance.now();
                this.initializeContactMap();
                
                document.getElementById('startBtn').disabled = true;
                document.getElementById('animationStatus').textContent = 'Starting simulation...';
                
                this.animate();
            }
            
            animate() {
                if (!this.isAnimating) return;
                
                const currentTime = performance.now();
                const elapsedTime = (currentTime - this.startTime) / 1000;
                const params = this.getInputValues();
                
                if (elapsedTime >= params.processTime) {
                    this.stopAnimation();
                    return;
                }
                
                // Update contact data based on brush and wafer positions
                this.updateContactData(elapsedTime);
                
                // Draw current state
                this.drawWafer(elapsedTime);
                
                this.animationId = requestAnimationFrame(() => this.animate());
            }
            
            updateContactData(elapsedTime) {
                const params = this.getInputValues();
                const nodules = this.calculateNodulePositions(params);
                const resolution = this.contactData.length;
                
                // Calculate current rotations
                const brushRotation = (params.brushSpeed * elapsedTime / 60) * 2 * Math.PI;
                const waferRotation = (params.waferSpeed * elapsedTime / 60) * 2 * Math.PI;
                
                const centerX = this.animationCanvas.width / 2;
                const centerY = this.animationCanvas.height / 2;
                const waferRadius = Math.min(centerX, centerY) - 10;
                const waferDiameterMM = params.waferDiameter;
                
                // For each nodule, check contact with wafer
                nodules.forEach(nodule => {
                    // Skip disabled nodules
                    const noduleId = `${nodule.row}-${nodule.index}`;
                    if (this.selectedNodules.has(noduleId)) {
                        return; // Skip this nodule
                    }
                    
                    const currentAngle = nodule.angle + brushRotation;
                    const brushRadius = params.brushDiameter / 2;
                    
                    // Calculate nodule position in 3D space
                    const noduleCircumX = Math.cos(currentAngle) * brushRadius; // radial position on brush
                    const noduleCircumY = Math.sin(currentAngle) * brushRadius; // vertical position relative to brush center
                    const noduleAxialPos = nodule.axialPos; // position along brush length
                    
                    // Check if nodule is at bottom of brush (making contact with wafer)
                    // Assuming brush center is at height = brushRadius above wafer
                    const contactThreshold = brushRadius - params.noduleDiameter / 2;
                    
                    if (noduleCircumY <= -contactThreshold) {
                        // Check if this nodule can make contact based on brush profile and compression
                        if (!this.canNoduleContact(nodule, params)) {
                            return; // Skip this nodule - it's not compressed enough to contact
                        }
                        
                        // Nodule is making contact with wafer
                        // Map brush axial position to wafer radial distance
                        // Brush spans from center to edge of wafer
                        const brushCenter = params.brushLength / 2;
                        const distanceFromBrushCenter = noduleAxialPos - brushCenter;
                        const waferRadialDistance = Math.abs(distanceFromBrushCenter);
                        
                        // Only consider contact if within wafer radius
                        if (waferRadialDistance <= waferDiameterMM / 2) {
                            // Calculate wafer surface position considering wafer rotation
                            const waferAngle = waferRotation + (distanceFromBrushCenter > 0 ? 0 : Math.PI);
                            
                            // Convert to canvas coordinates
                            const canvasRadius = (waferRadialDistance / (waferDiameterMM / 2)) * waferRadius;
                            const canvasX = centerX + canvasRadius * Math.cos(waferAngle);
                            const canvasY = centerY + canvasRadius * Math.sin(waferAngle);
                            
                            // Update contact data with broader contact area
                            const contactRadius = Math.max(1, (params.noduleDiameter / waferDiameterMM) * waferRadius);
                            
                            for (let dx = -contactRadius; dx <= contactRadius; dx++) {
                                for (let dy = -contactRadius; dy <= contactRadius; dy++) {
                                    if (dx*dx + dy*dy <= contactRadius*contactRadius) {
                                        const contactX = canvasX + dx;
                                        const contactY = canvasY + dy;
                                        
                                        const gridX = Math.floor((contactX / this.animationCanvas.width) * resolution);
                                        const gridY = Math.floor((contactY / this.animationCanvas.height) * resolution);
                                        
                                        if (gridX >= 0 && gridX < resolution && gridY >= 0 && gridY < resolution) {
                                            this.contactData[gridX][gridY] += 0.2; // Increased increment for visibility
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            stopAnimation() {
                this.isAnimating = false;
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                    this.animationId = null;
                }
                
                document.getElementById('startBtn').disabled = false;
                document.getElementById('animationStatus').textContent = 'Simulation stopped';
            }
            
            clearAndReset() {
                this.stopAnimation();
                this.selectedNodules.clear(); // Reset selected nodules
                this.updateBrushVisualization();
                this.initializeContactMap();
                document.getElementById('animationStatus').textContent = 'Ready to simulate';
            }
            
            clearHeatMap() {
                this.stopAnimation();
                this.initializeContactMap();
                document.getElementById('animationStatus').textContent = 'Heat map cleared - Ready to simulate';
            }
            
            clearSelectedNodules() {
                this.selectedNodules.clear();
                this.updateBrushVisualization();
                document.getElementById('animationStatus').textContent = 'Selected nodules cleared - All nodules active';
            }
            
            showNonContactedAreas() {
                this.stopAnimation();
                
                const ctx = this.animationCtx;
                const canvas = this.animationCanvas;
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const waferRadius = Math.min(centerX, centerY) - 10;
                const resolution = this.contactData.length;
                
                // Clear canvas with white background
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Fill entire wafer area with white
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(centerX, centerY, waferRadius, 0, 2 * Math.PI);
                ctx.fill();
                
                // Draw non-contacted areas in black
                for (let i = 0; i < resolution; i++) {
                    for (let j = 0; j < resolution; j++) {
                        const x = (i / resolution) * canvas.width;
                        const y = (j / resolution) * canvas.height;
                        
                        // Check if point is within wafer circle
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance <= waferRadius) {
                            const contactValue = this.contactData[i][j];
                            
                            // If no contact detected, draw black pixel
                            if (contactValue === 0) {
                                ctx.fillStyle = 'black';
                                const pixelSize = canvas.width / resolution;
                                ctx.fillRect(x - pixelSize/2, y - pixelSize/2, pixelSize, pixelSize);
                            }
                        }
                    }
                }
                
                // Draw wafer outline
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(centerX, centerY, waferRadius, 0, 2 * Math.PI);
                ctx.stroke();
                
                document.getElementById('animationStatus').textContent = 'Showing non-contacted areas in black';
            }
            
            showLowContactAreas() {
                this.stopAnimation();
                
                const ctx = this.animationCtx;
                const canvas = this.animationCanvas;
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const waferRadius = Math.min(centerX, centerY) - 10;
                const resolution = this.contactData.length;
                
                // Clear canvas with white background
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Fill entire wafer area with white
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(centerX, centerY, waferRadius, 0, 2 * Math.PI);
                ctx.fill();
                
                // Define low contact threshold (adjust this value as needed)
                const lowContactThreshold = 3; // Contact values below this are considered "low"
                
                // Draw areas with no contact or low contact
                for (let i = 0; i < resolution; i++) {
                    for (let j = 0; j < resolution; j++) {
                        const x = (i / resolution) * canvas.width;
                        const y = (j / resolution) * canvas.height;
                        
                        // Check if point is within wafer circle
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance <= waferRadius) {
                            const contactValue = this.contactData[i][j];
                            
                            // Color based on contact level
                            let fillColor = null;
                            if (contactValue === 0) {
                                // No contact - black
                                fillColor = 'black';
                            } else if (contactValue <= lowContactThreshold) {
                                // Low contact - grey
                                fillColor = '#808080';
                            }
                            
                            if (fillColor) {
                                ctx.fillStyle = fillColor;
                                const pixelSize = canvas.width / resolution;
                                ctx.fillRect(x - pixelSize/2, y - pixelSize/2, pixelSize, pixelSize);
                            }
                        }
                    }
                }
                
                // Draw wafer outline
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(centerX, centerY, waferRadius, 0, 2 * Math.PI);
                ctx.stroke();
                
                // Add legend for the new visualization
                ctx.fillStyle = '#333';
                ctx.font = '12px Arial';
                ctx.textAlign = 'left';
                
                // Black square for no contact
                ctx.fillStyle = 'black';
                ctx.fillRect(10, 10, 15, 15);
                ctx.fillStyle = '#333';
                ctx.fillText('No Contact', 30, 22);
                
                // Dark red square for low contact
                ctx.fillStyle = '#808080';
                ctx.fillRect(10, 30, 15, 15);
                ctx.fillStyle = '#333';
                ctx.fillText('Low Contact', 30, 42);
                
                // White square for adequate contact
                ctx.fillStyle = 'white';
                ctx.strokeStyle = '#333';
                ctx.strokeRect(10, 50, 15, 15);
                ctx.fillStyle = '#333';
                ctx.fillText('Adequate Contact', 30, 62);
                
                document.getElementById('animationStatus').textContent = 'Showing low/no contact areas (Black = No contact, Grey = Low contact)';
            }
            
            handleBrushCanvasClick(event) {
                const rect = this.brushCanvas.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                const clickY = event.clientY - rect.top;
                
                // Check if click hit any nodule
                this.currentNodules.forEach(noduleData => {
                    const distance = Math.sqrt(
                        Math.pow(clickX - noduleData.x, 2) + 
                        Math.pow(clickY - noduleData.y, 2)
                    );
                    
                    if (distance <= noduleData.radius) {
                        // Toggle nodule selection
                        const noduleId = noduleData.id;
                        if (this.selectedNodules.has(noduleId)) {
                            this.selectedNodules.delete(noduleId);
                            console.log(`Reactivated nodule ${noduleId}`);
                        } else {
                            this.selectedNodules.add(noduleId);
                            console.log(`Disabled nodule ${noduleId}`);
                        }
                        
                        // Redraw brush visualization
                        this.updateBrushVisualization();
                        
                        // Reset contact map if not animating
                        if (!this.isAnimating) {
                            this.initializeContactMap();
                        }
                        
                        // Only process the first clicked nodule
                        return;
                    }
                });
            }
            
            exportConfiguration() {
                const params = this.getInputValues();
                const nodules = this.calculateNodulePositions(params);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                
                // Create configuration text content
                let configText = `Brush-Wafer Contact Simulator Configuration\n`;
                configText += `Export Date: ${new Date().toLocaleString()}\n`;
                configText += `${"=".repeat(50)}\n\n`;
                
                configText += `BRUSH PROPERTIES:\n`;
                configText += `Length: ${params.brushLength} mm\n`;
                configText += `Diameter: ${params.brushDiameter} mm\n`;
                configText += `Circumference: ${(Math.PI * params.brushDiameter).toFixed(2)} mm\n`;
                configText += `Speed: ${params.brushSpeed} RPM\n\n`;
                
                configText += `WAFER PROPERTIES:\n`;
                configText += `Diameter: ${params.waferDiameter} mm\n`;
                configText += `Speed: ${params.waferSpeed} RPM\n\n`;
                
                configText += `NODULE CONFIGURATION:\n`;
                configText += `Rows: ${params.noduleRows}\n`;
                configText += `Nodules per Row: ${params.nodulesPerRow}\n`;
                configText += `Pitch: ${params.nodulePitch} mm\n`;
                configText += `Diameter: ${params.noduleDiameter} mm\n`;
                configText += `Odd Rows Start: ${params.noduleStartOdd} mm\n`;
                configText += `Even Rows Start: ${params.noduleStartEven} mm\n`;
                configText += `Total Nodules: ${nodules.length}\n`;
                configText += `Active Nodules: ${nodules.length - this.selectedNodules.size}\n`;
                configText += `Disabled Nodules: ${this.selectedNodules.size}\n\n`;
                
                // Add disabled nodules list if any exist
                if (this.selectedNodules.size > 0) {
                    configText += `DISABLED NODULES:\n`;
                    const disabledList = Array.from(this.selectedNodules).sort();
                    disabledList.forEach(noduleId => {
                        const [row, index] = noduleId.split('-');
                        configText += `Row ${parseInt(row) + 1}, Nodule ${parseInt(index) + 1} (ID: ${noduleId})\n`;
                    });
                    configText += `\n`;
                }
                
                configText += `SIMULATION SETTINGS:\n`;
                configText += `Data Density: ${params.dataDensity}\n`;
                configText += `Process Time: ${params.processTime} seconds\n\n`;
                
                configText += `CALCULATED VALUES:\n`;
                configText += `Row Offset: ${Math.abs(params.noduleStartEven - params.noduleStartOdd).toFixed(1)} mm\n`;
                configText += `Brush Coverage Length: ${params.noduleStartOdd + (params.nodulesPerRow - 1) * params.nodulePitch} mm\n`;
                configText += `Nodule Density: ${(nodules.length / (Math.PI * params.brushDiameter * params.brushLength) * 1000).toFixed(2)} nodules/cm²\n\n`;
                
                configText += `DETAILED NODULE POSITIONS:\n`;
                configText += `Row\tIndex\tAxial Pos (mm)\tCircum Pos (mm)\tAngle (rad)\tStatus\n`;
                configText += `${"=".repeat(70)}\n`;
                
                nodules.forEach(nodule => {
                    const noduleId = `${nodule.row}-${nodule.index}`;
                    const status = this.selectedNodules.has(noduleId) ? 'DISABLED' : 'ACTIVE';
                    configText += `${nodule.row + 1}\t${nodule.index + 1}\t${nodule.axialPos.toFixed(2)}\t\t${nodule.circumPos.toFixed(2)}\t\t${nodule.angle.toFixed(3)}\t${status}\n`;
                });
                
                // Create and download file
                const blob = new Blob([configText], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `brush_config_${timestamp}.txt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                // Show confirmation
                const originalText = document.getElementById('exportBtn').textContent;
                document.getElementById('exportBtn').textContent = 'Exported!';
                document.getElementById('exportBtn').style.background = '#4CAF50';
                setTimeout(() => {
                    document.getElementById('exportBtn').textContent = originalText;
                    document.getElementById('exportBtn').style.background = '#2196F3';
                }, 2000);
            }
        }
        
        // Initialize the simulator when page loads
        window.addEventListener('load', () => {
            new BrushWaferSimulator();
        });