# Deep Learning Journal Layout Analysis 

A deep learning model that uses computer vision and neural networks to perform automated classification of journal page elements through region detection algorithms.

## Technical Overview

This system implements an object detection architecture (YOLOv5) fine tuned for my journal understanding. It achieves high marks on multi class detection with great accuracy metrics:
- mAP50: 0.978 (mean Average Precision)
- Class-specific performance:
  - Date Detection: 0.979 mAP50 with 0.923 precision
  - Title Recognition: 0.995 mAP50 with 0.993 precision
  - Content Analysis: 0.974 mAP50 with 0.993 precision
  - Primary Image Detection: 0.992 mAP50 with 0.958 precision
  - Secondary Image Classification: 0.950 mAP50 with 0.971 precision

## Architecture & Implementation

The system employs a neural network architecture optimized for document layout analysis:
- The Backbone: YOLOv5 with custom anchor optimization
- Input Resolution: 640x640 with dynamic resizing (A6 Journal on Goodnotes)
- Training Augmentation: Advanced data augmentation pipeline with targeted enhancement for date regions
- Loss Function: Multi component objective incorporating IoU and classification losses
- Class Weighting: Adaptive weighting scheme to handle class imbalance (I used it on images rather than location of date and titles)

### Model Inference

For single-image inference:
```bash
python3 journal_test.py --image SampleJournals/your-journal-image.jpg
```

For batch processing:
```bash
python3 journal_test.py --dir SampleJournals
```

## Output Visualization

The system generates annotated visualizations with class-specific color encoding:
- Date Regions: Blue (RGB: 255, 0, 0)
- Title Segments: Green (RGB: 0, 255, 0)
- Content Blocks: Red (RGB: 0, 0, 255)
- Primary Images: Orange (RGB: 255, 165, 0)
- Secondary Images: Purple (RGB: 128, 0, 128)

## System Architecture
```
journal_detection/
├── dataset/                # Training data pipeline
├── results/               # Inference outputs
├── SampleJournals/       # Raw input data
├── venv/                 # Isolated runtime environment
├── yolov5/              # Neural network architecture
├── journal_detection.py  # Training pipeline
├── journal_test.py      # Inference engine
└── labeled_journals.json # Ground truth annotations
```

### Environment Configuration

1. Initialize isolated runtime environment:
```bash
python3.9 -m venv venv
source venv/bin/activate
```

2. Install core dependencies:
```bash
pip3 install torch torchvision
pip3 install opencv-python numpy pyyaml
```

3. Clone and configure YOLOv5 architecture:
```bash
git clone https://github.com/ultralytics/yolov5
cd yolov5
pip3 install -r requirements.txt
cd ..
```
