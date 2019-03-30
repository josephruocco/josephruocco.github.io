 	
    <p> <?php include "templates/include/header.php" ?>
    
      
        <h3 class="title" style="padding-bottom: 10px;
font-size: 1.5em;">
   <?php echo htmlspecialchars( $results['article']->title )?> 
         </h3>   
         <div style="width: 75%; font-style: italic;"><?php echo htmlspecialchars( $results['article']->summary )?>
         </div>
         <div style="width: 75%; min-height: 300px;">

      <?php if ( $imagePath = $results['article']->getImagePath() ) { ?>
        <img id="articleImageFullsize" src="<?php echo $imagePath?>" alt="Article Image" style:"height:250px;"/>
      <?php } ?>
      <p style="line-height: 1"> <?php echo $results['article']->content?> </p>
      </div>
      
      </div>
      
     
      <p class="pubDate" style = "padding-top: 10px; padding-left: 10%; padding-right: 10%;">Published <?php echo date('j F Y', $results['article']->publicationDate)?>
<?php if ( $results['category'] ) { ?>
        in <a href="./?action=archive&amp;categoryId=<?php echo $results['category']->id?>"><?php echo htmlspecialchars( $results['category']->name ) ?></a>
<?php } ?>
      </p>
    
      