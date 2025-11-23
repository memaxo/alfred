import argparse
import os
import logging
from mlx_lm import convert

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MayaConverter")

def main():
    parser = argparse.ArgumentParser(description="Convert Maya1 HuggingFace model to MLX format")
    parser.add_argument("--hf-model", type=str, default="maya-research/maya1", help="HuggingFace model ID")
    parser.add_argument("--output-dir", type=str, default="models/maya1-mlx", help="Output directory")
    parser.add_argument("--quantize", action="store_true", help="Quantize to 4-bit")
    
    args = parser.parse_args()
    
    logger.info(f"Converting {args.hf_model} to {args.output_dir}...")
    if args.quantize:
        logger.info("Quantization enabled (4-bit)")
        
    # Use mlx_lm's convert CLI
    import subprocess
    import sys
    
    cmd = [
        sys.executable, "-m", "mlx_lm.convert",
        "--hf-path", args.hf_model,
        "--mlx-path", args.output_dir,
    ]
    
    if args.quantize:
        cmd.append("-q")
        
    logger.info(f"Running: {' '.join(cmd)}")
    
    try:
        subprocess.run(cmd, check=True)
        logger.info("Conversion complete!")
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Conversion failed with exit code {e.returncode}")

if __name__ == "__main__":
    main()
