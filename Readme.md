# Development of a Progressive Web Application for Coffee Leaf Condition Identification Using Artificial Intelligence

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23480207.svg)](https://doi.org/10.5281/zenodo.23480207)

**Author:** Lameck Silva Fernandes  
**Affiliation:** Independent Researcher  
**Location:** Passos, MG, Brazil  

---

## Abstract

Coffee production has substantial economic and social importance, and plant health monitoring is important for maintaining productivity and crop quality. Identifying diseases and pests affecting coffee leaves through visual inspection may require time and specialist knowledge. Computer vision can support tools for the preliminary identification of visible leaf conditions.

This paper presents CoffeeLeaf AI, a Progressive Web Application (PWA) integrating an image classification model for five coffee leaf condition categories: Healthy, Miner, Rust, Phoma, and Cercospora. A total of 5,000 images, comprising 1,000 samples per class, were organized from publicly available datasets and used in a model trained with Google Teachable Machine. The training configuration used 50 epochs, a batch size of 16, and a learning rate of 0.001. The resulting model was integrated into a browser-accessible application that displays predicted classes and confidence scores.

A functional demonstration showed a prediction of "Healthy" with a displayed confidence score of 100.0 for a single image. This observation demonstrates the application's prediction interface but does not establish overall model accuracy. No quantitative evaluation results from a separately documented independent test set are reported. Further evaluation on labeled, held-out images and external validation are needed to assess model performance and generalization. CoffeeLeaf AI is intended to support preliminary visual assessment and does not replace evaluation by a qualified plant-health specialist.

**Keywords:** artificial intelligence; computer vision; Arabica coffee; leaf diseases; machine learning; Progressive Web App; image classification.

---

## 1. Introduction

Coffee production is influenced by the phytosanitary condition of plants. Pests and diseases affecting leaves may compromise plant development and, consequently, crop production. These conditions are often identified through visual observation, which requires sufficient knowledge to distinguish symptoms that may look similar.

Recent advances in artificial intelligence, particularly computer vision, have enabled systems to analyze images and identify visual patterns associated with different plant conditions. Datasets containing labeled images are important for training and evaluating supervised machine-learning models.

The JMuBEN/JMuBEN2 dataset [2, 3] used in this study contains images of Arabica coffee leaves collected at a farm in Mutira, Kirinyaga County, Kenya. Image acquisition took place under field conditions, and a plant pathologist contributed to the identification of leaf conditions. The dataset contains five classes: Healthy, Miner, Rust, Phoma, and Cercospora.

The dataset is intended for classification of leaf conditions. This differs from BRACOT, a dataset developed for instance segmentation of coffee leaves, with 300 images and 1,662 annotated instances [4]. Because this study focuses on classifying leaf conditions, JMuBEN/JMuBEN2 was used as the primary dataset.

This paper documents the development of an image classification model integrated into a Progressive Web App (PWA). The implemented interface allows users to submit coffee leaf images and view the predicted class. The study focuses on the implementation of the application and a functional demonstration of its prediction interface; quantitative model performance is not evaluated in this report.

## 2. Materials and Methods

### 2.1 Dataset

The original JMuBEN/JMuBEN2 dataset is reported to contain 58,555 images across five classes. For the CoffeeLeaf AI project, a subset of 5,000 images was selected from the original dataset, comprising 1,000 images per class: Healthy, Miner, Rust, Phoma, and Cercospora. For each class, the first 1,000 images in the dataset's existing order were selected. The selected images were then renamed and organized by class before being uploaded to Google Teachable Machine for training. This subset represents only part of the original dataset; no random sampling procedure was used.

**Table 1: Reported class distribution of the JMuBEN/JMuBEN2 dataset.**

| Class | Number of images |
| :--- | :--- |
| Healthy | 18,985 |
| Miner | 16,979 |
| Rust | 8,337 |
| Phoma | 6,572 |
| Cercospora | 7,682 |
| **Total** | **58,555** |

The five classes used in the CoffeeLeaf AI project were retained as supplied by the dataset: Healthy (healthy leaf), Miner (leaf miner), Rust (coffee leaf rust), Phoma, and Cercospora. These class names were kept consistent when organizing the selected images for training.

### 2.2 Dataset sampling and illustrative images

Figure 1 shows representative images from the five coffee leaf condition classes.

*(In the actual PDF, there is a figure showing representative images. In this Markdown, you can insert the image link or just reference it).*

### 2.3 Image preprocessing

A subset of 5,000 images was selected from the publicly available JMuBEN/JMuBEN2 dataset, comprising 1,000 images from each of the five classes: Healthy, Miner, Rust, Phoma, and Cercospora. The selected images were renamed and organized into class-specific groups before being uploaded to Google Teachable Machine. No additional manual image preprocessing was performed before uploading. Any resizing, normalization, or other transformations applied internally by the platform were not independently configured or verified and are therefore not specified here.

### 2.4 Model training and data partitioning

Generative AI tools (ChatGPT, OpenAI) were used to assist in drafting the manuscript and in providing technical guidance for writing the code used to train and implement the classification model. The author reviewed and validated all AI-generated content and code.

The image classification model was trained using Google Teachable Machine. Internally, the platform employs a Convolutional Neural Network (CNN), specifically utilizing the MobileNet architecture as a backbone via transfer learning [citation:3][citation:6]. This lightweight architecture is designed for efficient image classification on mobile and web environments. The training configuration used in the platform's interface consisted of 50 epochs, a batch size of 16, and a learning rate of 0.001. The model was trained in a single session using the platform's training interface.

The platform's automatic data partitioning was used. However, the exact partitioning proportions and the specific roles of the resulting subsets were not independently verified. The exported model files are needed to further document the model architecture and implementation details.

After training, predictions were inspected using the CoffeeLeaf AI Progressive Web Application (PWA). No quantitative evaluation on a separately documented, independent test set was conducted. Accordingly, no overall accuracy, precision, recall, or F1-score is reported in this study.

### 2.5 Classification tasks

The implemented classification task assigns input coffee leaf images to one of five categories: Healthy, Miner, Rust, Phoma, or Cercospora. The model's output is presented by the application as a predicted class and an associated confidence score.

## 3. CoffeeLeaf AI Progressive Web Application

The CoffeeLeaf AI PWA integrates the trained image classification model into an application workflow that displays the predicted class and its associated confidence score. Predictions for selected images were inspected after training. This study reports a functional demonstration of the application rather than a quantitative evaluation of model performance.

## 4. System Architecture

The CoffeeLeaf AI system comprises a model development stage and an application stage. During model development, 5,000 labeled coffee leaf images across five classes were used to train an image classification model with Google Teachable Machine. During application use, an input image is processed by the integrated model, and the application displays the predicted class and its associated confidence score. The system is presented as a functional application prototype; its overall classification performance has not been quantitatively established in this study.

## 5. Results and Discussion

A functional demonstration of CoffeeLeaf AI showed the application displaying the predicted class "Healthy" with a confidence score of 100.0. This observation illustrates the application's prediction interface for a single input image; it does not establish the model's overall classification accuracy or generalization performance. Although the model was trained using the automatic data partitioning provided by Google Teachable Machine, no quantitative evaluation results from a separately documented independent test set are reported. Future work should evaluate the model using labeled images not used during training and report appropriate performance metrics.

## 6. Discussion and Limitations

The project integrates an image classifier with a browser-accessible PWA for preliminary classification of coffee leaf images. The interface supports the image-input methods implemented in the released version; any camera functionality should be confirmed against the code.

A key limitation is that JMuBEN/JMuBEN2 represents a particular geographic origin and a specific dataset collection process. Performance on coffee farms in other regions, under different climate conditions, with different cultivars, or using different devices cannot be assumed from results on the original dataset alone. External validation using appropriately labeled images from the intended deployment region is needed before making claims about field reliability.

The system should be interpreted as a decision-support aid, and its performance claims should remain limited to the conditions evaluated in this study. The model's predictions should not be treated as definitive diagnoses.

## 7. Conclusion

CoffeeLeaf AI demonstrates the integration of an image classification model into a Progressive Web Application for coffee leaf condition identification. The application displays predicted classes and associated confidence scores, providing a functional demonstration of the proposed workflow. However, the observations reported in this study do not establish overall model accuracy. A quantitative evaluation using a documented independent test set is needed to assess classification performance and generalization.

## Data Availability Statement

The original JMuBEN/JMuBEN2 dataset is available from its original source [3]. The CoffeeLeaf AI project uses a subset of 5,000 images, comprising 1,000 images per class, selected and reorganized from the original dataset. Project materials are available in the public GitHub repository [1]. Reuse and redistribution of the images are subject to the original dataset's licensing terms.

## Code Availability

The CoffeeLeaf AI source code is publicly available at [https://github.com/EuFreela/coffeeleaf-ai](https://github.com/EuFreela/coffeeleaf-ai). The repository contains the project source code and associated project materials.

## Funding

This research received no external funding.

## Conflicts of Interest

The author declares no conflicts of interest.

## Declaration of AI Usage

During the preparation of this manuscript, the author used ChatGPT (OpenAI) for the following purposes: (1) to assist in drafting and structuring the manuscript; (2) to translate and refine the English language; and (3) to assist in writing the code and guiding the training of the machine learning model. After using this tool, the author reviewed and edited all content (text and code) and takes full responsibility for the accuracy, integrity, and originality of the publication.

## References

[1] Lameck Silva Fernandes. CoffeeLeaf AI: Image classification application and training data. [https://github.com/EuFreela/coffeeleaf-ai](https://github.com/EuFreela/coffeeleaf-ai), 2026. Source code and project-organized image data.

[2] J. Jepkoech, D. M. Mugo, B. K. Kenduiywo, and E. C. Too. Arabica coffee leaf images dataset for coffee leaf disease detection and classification. Data in Brief, 36:107142, 2021. doi: 10.1016/j.dib.2021.107142. URL [https://pmc.ncbi.nlm.nih.gov/articles/PMC8165403/](https://pmc.ncbi.nlm.nih.gov/articles/PMC8165403/).

[3] JMuBEN/JMuBEN2 dataset authors. Arabica coffee leaf disease classification dataset: Jmuben/jmuben2. Mendeley Data, 2021. URL [https://data.mendeley.com/datasets/t2r6rszp5c/1](https://data.mendeley.com/datasets/t2r6rszp5c/1).

[4] R. Krohling, J. E. Tozzi de Souza, and L. M. Tassis. BRACOT - a brazilian arabica coffee tree images dataset for instance segmentation of coffee leaves. Mendeley Data, 2021. URL [https://data.mendeley.com/datasets/pmkbyjpf6k/1](https://data.mendeley.com/datasets/pmkbyjpf6k/1).
