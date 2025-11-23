import os
import sys

# Add the parent directory to sys.path to allow imports from the package
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tts.server import main

if __name__ == "__main__":
    main()
