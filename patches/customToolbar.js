let sheet = (function() {
    let style = document.createElement("style");
    style.appendChild(document.createTextNode(""));
    document.head.appendChild(style);
    return style.sheet;
   })();
   function editToolBar(){
    //when the page is resized, the viewer hides and move some buttons around.
    //this function forcibly show all buttons so none of them disappear or re-appear on page resize
    removeGrowRules();
  
    /* Reorganizing the UI */
    // the 'addElemFromSecondaryToPrimary' function moves items from the secondary nav into the primary nav
    // there are 3 primary nav regions (toolbarViewerLeft, toolbarViewerMiddle, toolbarViewerRight)
  
    //adding elements to left part of toolbar
    //addElemFromSecondaryToPrimary('pageRotateCcw', 'toolbarViewerLeft')
    //addElemFromSecondaryToPrimary('pageRotateCw', 'toolbarViewerLeft')
    //addElemFromSecondaryToPrimary('zoomIn', 'toolbarViewerLeft')
    //addElemFromSecondaryToPrimary('zoomOut', 'toolbarViewerLeft')
  
    //adding elements to middle part of toolbar
    //addElemFromSecondaryToPrimary('previous', 'toolbarViewerMiddle')
    addElemFromSecondaryToPrimary('pageNumber', 'toolbarViewerMiddle')
    addElemFromSecondaryToPrimary('numPages', 'toolbarViewerMiddle')
    //addElemFromSecondaryToPrimary('next', 'toolbarViewerMiddle')
  
    //adding elements to right part of toolbar
    //addElemFromSecondaryToPrimary('secondaryDownload', 'toolbarViewerRight')
  
  
    /* Hiding elements */
    removeElement('secondaryToolbarToggle')
    removeElement('scaleSelectContainer')
    removeElement('presentationMode')
    removeElement('openFile')
    removeElement('print')
    removeElement('download')
    removeElement('viewBookmark')
    removeElement('viewFind')
    removeElement('next')
    removeElement('previous')
    removeElement('zoomIn')
    removeElement('zoomOut')
    //removeElement('pageRotateCcw')
    //removeElement('pageRotateCw')
   }
  function changeIcon(elemID, iconUrl){
      let element = $('#'+elemID)
      let classNames = element[0].className;
      classNames = elemID.includes('Toggle')? 'toolbarButton#'+elemID : classNames.split(' ').join('.');
      classNames = elemID.includes('view')?  '#'+elemID+'.toolbarButton' : '.'+classNames
      classNames+= "::before";
      addCSSRule(sheet, classNames, `content: url(${iconUrl}) !important`, 0)
  }
  function addElemFromSecondaryToPrimary(elemID, parentID){
      let element = $('#'+elemID);
      let parent = $('#'+parentID);
      $(element).css('min-width', '0px');
      $(element).empty();
      $(parent).append(element);
  }
  function removeElement(elemID){
      $('#'+elemID).remove();
  }
  function removeGrowRules(){
      addCSSRule(sheet, '.hiddenSmallView *', 'display:block !important');
      addCSSRule(sheet, '.hiddenMediumView', 'display:block !important');
      addCSSRule(sheet, '.hiddenLargeView', 'display:block !important');
      addCSSRule(sheet, '.visibleSmallView', 'display:block !important');
      addCSSRule(sheet, '.visibleMediumView', 'display:block !important');
      addCSSRule(sheet, '.visibleLargeView', 'display:block !important');
  }
  function addCSSRule(sheet, selector, rules, index) {
      if("insertRule" in sheet) {
          sheet.insertRule(selector + "{" + rules + "}", index);
      }
      else if("addRule" in sheet) {
          sheet.addRule(selector, rules, index);
      }
  }
  $(document).ready(editToolBar);