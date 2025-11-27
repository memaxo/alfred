#!/bin/bash
# Script to close duplicate Linear issues
# Run this script to mark duplicates as canceled

set -e

echo "Closing duplicate Linear issues..."

# ALF-77 is duplicate of ALF-131
echo "Closing ALF-77 (duplicate of ALF-131)..."
# Use Linear CLI or API to update:
# linear issue update ALF-77 --state "Canceled" --description "Duplicate of ALF-131"

# ALF-75 is duplicate of ALF-79  
echo "Closing ALF-75 (duplicate of ALF-79)..."
# Use Linear CLI or API to update:
# linear issue update ALF-75 --state "Canceled" --description "Duplicate of ALF-79"

echo "Done. Please manually close these issues in Linear:"
echo "  - ALF-77 → Canceled (duplicate of ALF-131)"
echo "  - ALF-75 → Canceled (duplicate of ALF-79)"

