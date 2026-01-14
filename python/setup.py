from setuptools import setup, find_packages

setup(
    name="dynamic-template-engine",
    version="1.0.0",
    description="LangGraph plugin for generating pixel-perfect documents with content-aware text fitting",
    author="",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "langchain-core>=0.1.0",
        "pydantic>=2.0.0",
    ],
    extras_require={
        "langgraph": [
            "langgraph>=0.0.1",
            "langchain-openai>=0.0.1",
        ],
        "pdf": [
            "playwright>=1.40.0",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)
