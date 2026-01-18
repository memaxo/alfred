"""
Qwen3-VL-Embedding Helper
Wrapper around the Qwen3-VL-Embedding model for easy embedding generation
Based on: https://huggingface.co/Qwen/Qwen3-VL-Embedding-2B
"""

import os
from typing import List, Dict, Any, Optional
import torch


class Qwen3VLEmbedder:
    """
    Embedder class for Qwen3-VL-Embedding models.
    Supports text, image, and mixed (text + image) inputs.
    """
    
    def __init__(
        self,
        model_name_or_path: str = "Qwen/Qwen3-VL-Embedding-2B",
        torch_dtype: Optional[torch.dtype] = None,
        device: Optional[str] = None,
        attn_implementation: Optional[str] = None,
    ):
        from transformers import Qwen2VLForConditionalGeneration, AutoProcessor
        
        self.model_name = model_name_or_path
        
        # Resolve device
        if device is None:
            if torch.cuda.is_available():
                device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"
        self.device = device
        
        # Resolve dtype
        if torch_dtype is None:
            torch_dtype = torch.float16 if device != "cpu" else torch.float32
        self.torch_dtype = torch_dtype
        
        # Load processor
        self.processor = AutoProcessor.from_pretrained(
            model_name_or_path,
            trust_remote_code=True,
        )
        
        # Load model with optional flash attention
        model_kwargs = {
            "trust_remote_code": True,
            "torch_dtype": torch_dtype,
        }
        if attn_implementation:
            model_kwargs["attn_implementation"] = attn_implementation
        
        self.model = Qwen2VLForConditionalGeneration.from_pretrained(
            model_name_or_path,
            **model_kwargs,
        ).to(device)
        
        self.model.eval()
        
        # Default instruction for embedding
        self.default_instruction = "Represent the user's input."
    
    def _format_input_to_conversation(
        self,
        input_dict: Dict[str, Any],
        instruction: str
    ) -> List[Dict]:
        """Format input into conversation format for the model."""
        content = []
        
        text = input_dict.get("text")
        image = input_dict.get("image")
        
        if image:
            image_content = None
            if isinstance(image, str):
                if image.startswith(("http", "https", "oss")):
                    image_content = image
                else:
                    abs_image_path = os.path.abspath(image)
                    image_content = "file://" + abs_image_path
            else:
                image_content = image
            
            if image_content:
                content.append({
                    "type": "image",
                    "image": image_content,
                })
        
        if text:
            content.append({"type": "text", "text": text})
        
        if not content:
            content.append({"type": "text", "text": ""})
        
        conversation = [
            {"role": "system", "content": [{"type": "text", "text": instruction}]},
            {"role": "user", "content": content}
        ]
        
        return conversation
    
    def _get_embeddings(self, inputs: Dict[str, Any]) -> torch.Tensor:
        """Extract embeddings from model outputs."""
        with torch.no_grad():
            outputs = self.model(**inputs, output_hidden_states=True)
            
            # Get the last hidden state
            hidden_states = outputs.hidden_states[-1]
            
            # Mean pooling over sequence length (excluding padding)
            attention_mask = inputs.get("attention_mask")
            if attention_mask is not None:
                mask_expanded = attention_mask.unsqueeze(-1).expand(hidden_states.size()).float()
                sum_embeddings = torch.sum(hidden_states * mask_expanded, dim=1)
                sum_mask = torch.clamp(mask_expanded.sum(dim=1), min=1e-9)
                embeddings = sum_embeddings / sum_mask
            else:
                embeddings = hidden_states.mean(dim=1)
            
            # Normalize embeddings
            embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
            
            return embeddings
    
    def process(
        self,
        inputs: List[Dict[str, Any]],
        instruction: Optional[str] = None,
    ) -> List[List[float]]:
        """
        Process a list of inputs and return embeddings.
        
        Args:
            inputs: List of input dictionaries. Each can have:
                - {"text": "..."} for text-only
                - {"image": "url or path"} for image-only
                - {"text": "...", "image": "url or path"} for mixed
            instruction: Optional instruction for the embedding task
        
        Returns:
            List of embedding vectors (as lists of floats)
        """
        if instruction is None:
            instruction = self.default_instruction
        
        embeddings_list = []
        
        # Process each input individually (for simplicity with multimodal)
        for input_dict in inputs:
            conversation = self._format_input_to_conversation(input_dict, instruction)
            
            # Apply chat template
            text_prompt = self.processor.apply_chat_template(
                conversation,
                tokenize=False,
                add_generation_prompt=True,
            )
            
            # Process with processor
            image = input_dict.get("image")
            if image:
                # Handle image loading
                from qwen_vl_utils import fetch_image
                
                if isinstance(image, str):
                    try:
                        image_obj = fetch_image(image)
                    except Exception:
                        # Fallback to PIL
                        from PIL import Image
                        import requests
                        from io import BytesIO
                        
                        if image.startswith(("http://", "https://")):
                            response = requests.get(image)
                            image_obj = Image.open(BytesIO(response.content))
                        else:
                            image_obj = Image.open(image)
                else:
                    image_obj = image
                
                processed = self.processor(
                    text=[text_prompt],
                    images=[image_obj],
                    return_tensors="pt",
                    padding=True,
                )
            else:
                processed = self.processor(
                    text=[text_prompt],
                    return_tensors="pt",
                    padding=True,
                )
            
            # Move to device
            processed = {k: v.to(self.device) for k, v in processed.items()}
            
            # Get embeddings
            embeddings = self._get_embeddings(processed)
            embeddings_list.append(embeddings[0].cpu().tolist())
        
        return embeddings_list
