#include "parserClass.hpp"

// Counts leading whitespace to determine indentation level
int Parser::countIndent(const string& line){
    int count = 0;

    // Iterates through characters until non-whitespace is found
    for (char c : line){
        if(c==' ') count++;
        else if (c=='\t') count += 4;
        else break;
    }
    return count;
}

// Removes leading and trailing whitespace
string Parser::trim(const string& line){
    
    // Finds first non-whitespace character
    size_t start = line.find_first_not_of(" \t");

    // If there are no non whitespace characters in the checked line, return
    if (start == string::npos) return "";

    // Finds last non-whitespace character
    size_t end = line.find_last_not_of(" \t");

    return line.substr(start, end - start + 1);
}

// Determines the start of each block
bool Parser::startBlock(const string& line){

    string s = trim(line);

    if(s.empty()) return false;

    return s.back() == ':';
}

// Determines the type of each block
BlockType Parser::detectType(const string& line){
    string s = trim(line);

    /*
    Looks at the first character of the block and determines the type of block
    Special case 1: elif, else, and except all start with e so the third character is checked to differentiate
    Special case 2: while and with both start with w so the second letter is checked to differentiate
    */
    switch(s[0]){
        case 'c': return BlockType::CLASS;
        case 'd': return BlockType::FUNCTION;
        case 'i': return BlockType::IF;
        case 'e':
            switch(s[2]){
                case 'i': return BlockType::ELIF;
                case 's': return BlockType::ELSE;
                case 'c': return BlockType::EXCEPT;
            }
        case 'f': return BlockType::FOR;
        case 'w':
            switch(s[1]){
                case 'h': return BlockType::WHILE;
                case 'i': return BlockType::WITH;
            }
        case 't': return BlockType::TRY;
        default: return BlockType::UNKNOWN;
    }
}

// Reads the file and returns a vector of all block events
vector<BlockEvent> Parser::parseFile(ifstream& file){
    vector<BlockEvent> events;
    stack<ActiveBlock> blockStack;

    string line;
    int lineNumber = 0;

    // Read file line by line
    while(getline(file, line)){
        lineNumber++;

        int indentLevel = countIndent(line);
        string trimmed = trim(line);

        if(trimmed.empty()) continue;

        // Handle dedents (close blocks)
        while(!blockStack.empty() && indentLevel < blockStack.top().indentLevel) {
            BlockEvent endEvent;
            endEvent.isStart = false;
            endEvent.type = blockStack.top().type;
            endEvent.lineNumber = lineNumber;
            endEvent.indentLevel = indentLevel;
            endEvent.lineText = trimmed;

            events.push_back(endEvent);

            blockStack.pop();
        }

        // Determine current active block (smallest enclosing block)
        BlockType activeType = BlockType::UNKNOWN;
        if(!blockStack.empty() {
            activeType = blockStack.top();
        })

        // Hand new block start
        if (startBlock(line)) {
            BlockType detectedType = detectedType(line);

            BlockEvent startEvent;
            startEvent.isStart = true;
            startEvent.type = detectType(line);
            startEvent.lineNumber = lineNumber;
            startEvent.indentLevel = indentLevel;
            startEvent.lineText = trimmed;

            events.push_back(startEvent);

            blockStack.push({detectedType, indentLevel}); // Push only tracking information
        }
    }

     // Close remaining blocks at EOF(End-Of-File)
        while (!blockStack.empty()) {
            BlockEvent endEvent;
            endEvent.isStart = false;
            endEvent.type = blockStack.top().type;
            endEvent.lineNumber = lineNumber;
            endEvent.indentLevel = 0;
            endEvent.lineText = "EOF";

            events.push_back(endEvent);

            blockStack.pop();
        }

    return events;
}