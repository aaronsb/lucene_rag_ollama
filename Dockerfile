# Use Ubuntu as base to install PyLucene dependencies
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install Python and required system dependencies
RUN apt-get update && \
    apt-get install -y software-properties-common && \
    add-apt-repository -y ppa:openjdk-r/ppa && \
    apt-get update && \
    apt-get install -y \
    python3.10 \
    python3-pip \
    python3-dev \
    openjdk-21-jdk \
    openjdk-21-jdk-headless \
    git \
    ant \
    build-essential \
    wget \
    libicu-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set JAVA_HOME and library paths
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV JCC_JDK=/usr/lib/jvm/java-21-openjdk-amd64
ENV LD_LIBRARY_PATH=$JAVA_HOME/lib:$JAVA_HOME/lib/server:$LD_LIBRARY_PATH
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Create symbolic links for Java libraries
RUN mkdir -p $JAVA_HOME/jre/lib/amd64/server && \
    mkdir -p $JAVA_HOME/jre/lib/amd64 && \
    ln -s $JAVA_HOME/lib/server/libjvm.so $JAVA_HOME/jre/lib/amd64/server/ && \
    ln -s $JAVA_HOME/lib/libjava.so $JAVA_HOME/jre/lib/amd64/

# Download and build PyLucene with modified compilation steps
WORKDIR /tmp
RUN wget https://downloads.apache.org/lucene/pylucene/pylucene-10.0.0-src.tar.gz && \
    tar xzf pylucene-10.0.0-src.tar.gz && \
    cd pylucene-10.0.0 && \
    cd jcc && \
    JCC_JDK=/usr/lib/jvm/java-21-openjdk-amd64 python3 setup.py build && \
    JCC_JDK=/usr/lib/jvm/java-21-openjdk-amd64 python3 setup.py install && \
    cd .. && \
    # Modify the JCC command in Makefile to fix the --files parameter
    sed -i 's/--files/--files 100/g' Makefile && \
    make all install JCC='python3 -m jcc' ANT=ant PYTHON=python3 JDK=/usr/lib/jvm/java-21-openjdk-amd64

# Set working directory
WORKDIR /app

# Copy requirements (excluding pylucene since we built it)
COPY requirements.txt .
RUN sed -i '/python-lucene/d' requirements.txt

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Create index directory with proper permissions
RUN mkdir -p /app/index && \
    chmod 777 /app/index

# Copy application code
COPY . .

# Expose the port the app runs on
EXPOSE 3333

# Command to run the application using uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3333"]
